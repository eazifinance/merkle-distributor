import { expect } from "chai";
import { BigNumberish } from "ethers";
import { ethers, waffle } from "hardhat";

import Generator from "../src/generator";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  MerkleDistributorVesting,
  MerkleDistributorVesting__factory,
  TestERC20,
  TestERC20__factory,
  VestingWallet,
  VestingWallet__factory
} from "../typechain";

const { constants, BigNumber } = ethers;

const percentOf = (percent: BigNumberish, value: BigNumberish) => {
  return BigNumber.from(value).mul(percent).div(100);
};

describe("MerkleDistributorVesting", () => {
  let wallet0: SignerWithAddress;
  let wallet1: SignerWithAddress;
  let wallets: SignerWithAddress[];

  let tokenFactory: TestERC20__factory;
  let distributorFactory: MerkleDistributorVesting__factory;

  before(async () => {
    wallets = await ethers.getSigners();
    wallet0 = wallets[0];
    wallet1 = wallets[1];
    tokenFactory = await ethers.getContractFactory("TestERC20");
    distributorFactory = await ethers.getContractFactory(
      "MerkleDistributorVesting"
    );
  });

  let token: TestERC20;
  beforeEach("deploy token", async () => {
    token = await tokenFactory.deploy("Eazi", "EAZI", 0);
    await token.deployed();
  });

  describe("#token", () => {
    it("returns the token address", async () => {
      const distributor = await distributorFactory.deploy(
        token.address,
        constants.HashZero,
        0,
        0
      );
      await distributor.deployed();
      expect(await distributor.token()).to.eq(token.address);
    });
  });

  describe("#merkleRoot", () => {
    it("returns the zero merkle root", async () => {
      const distributor = await distributorFactory.deploy(
        token.address,
        constants.HashZero,
        0,
        0
      );
      await distributor.deployed();
      expect(await distributor.merkleRoot()).to.eq(constants.HashZero);
    });
  });

  describe("#generateLeaf", () => {
    it("works same for BigNumberish -> number", async () => {
      const generator = new Generator(
        {
          [wallet0.address]: BigNumber.from(100)
        },
        0
      );
      const node = generator.generateLeaf(wallet0.address, 100);
      const proof = generator.tree
        .getHexProof(node)
        .map((el) => Buffer.from(el.slice(2), "hex"));

      const validProof = generator.tree.verify(
        proof,
        node,
        generator.tree.getHexRoot()
      );
      expect(validProof).to.be.true;
    });

    it("works same for number -> BigNumberish #2", async () => {
      const generator = new Generator(
        {
          [wallet0.address]: 100
        },
        0
      );
      const node = generator.generateLeaf(wallet0.address, BigNumber.from(100));
      const proof = generator.tree
        .getHexProof(node)
        .map((el) => Buffer.from(el.slice(2), "hex"));

      const validProof = generator.tree.verify(
        proof,
        node,
        generator.tree.getHexRoot()
      );
      expect(validProof).to.be.true;
    });

    it("works same for string -> BigNumberish #2", async () => {
      const generator = new Generator(
        {
          [wallet0.address]: "100"
        },
        0
      );
      const node = generator.generateLeaf(wallet0.address, BigNumber.from(100));
      const proof = generator.tree
        .getHexProof(node)
        .map((el) => Buffer.from(el.slice(2), "hex"));

      const validProof = generator.tree.verify(
        proof,
        node,
        generator.tree.getHexRoot()
      );
      expect(validProof).to.be.true;
    });
  });

  describe("#claim", () => {
    it("fails for empty proof", async () => {
      const distributor = await distributorFactory.deploy(
        token.address,
        constants.HashZero,
        0,
        0
      );
      await distributor.deployed();
      await expect(
        distributor.claim(wallet0.address, 10, [])
      ).to.be.revertedWith("NotEligible");
    });

    it("fails for invalid address", async () => {
      const distributor = await distributorFactory.deploy(
        token.address,
        constants.HashZero,
        0,
        0
      );
      await distributor.deployed();
      await expect(
        distributor.claim(wallet0.address, 10, [])
      ).to.be.revertedWith("NotEligible");
    });

    describe("two account tree", () => {
      let generator: Generator;
      let distributor: MerkleDistributorVesting;

      beforeEach("deploy", async () => {
        generator = new Generator(
          {
            [wallet0.address]: BigNumber.from(100),
            [wallet1.address]: BigNumber.from(101)
          },
          0
        );
        distributor = await distributorFactory.deploy(
          token.address,
          generator.tree.getHexRoot(),
          0,
          0
        );
        await distributor.deployed();
        await token.setBalance(distributor.address, 201);
      });

      it("successful claim", async () => {
        const proof0 = generator.tree.getHexProof(
          generator.generateLeaf(wallet0.address, BigNumber.from(100))
        );
        await expect(distributor.claim(wallet0.address, 100, proof0))
          .to.emit(distributor, "Claimed")
          .withArgs(wallet0.address, percentOf(30, 100));
        const proof1 = generator.tree.getHexProof(
          generator.generateLeaf(wallet1.address, BigNumber.from(101))
        );
        await expect(distributor.claim(wallet1.address, 101, proof1))
          .to.emit(distributor, "Claimed")
          .withArgs(wallet1.address, percentOf(30, 101));
      });

      it("transfers the token", async () => {
        const proof0 = generator.tree.getHexProof(
          generator.generateLeaf(wallet0.address, BigNumber.from(100))
        );
        expect(await token.balanceOf(wallet0.address)).to.eq(0);
        await distributor.claim(wallet0.address, 100, proof0);
        expect(await token.balanceOf(wallet0.address)).to.eq(
          percentOf(30, 100)
        );
      });

      it("must have enough to transfer", async () => {
        const proof0 = generator.tree.getHexProof(
          generator.generateLeaf(wallet0.address, BigNumber.from(100))
        );
        await token.setBalance(distributor.address, 99);
        await expect(
          distributor.claim(wallet0.address, 100, proof0)
        ).to.be.revertedWith("ERC20: transfer amount exceeds balance");
      });

      it("sets #isClaimed", async () => {
        const proof0 = generator.tree.getHexProof(
          generator.generateLeaf(wallet0.address, BigNumber.from(100))
        );
        expect(await distributor.isClaimed(wallet0.address)).to.eq(false);
        expect(await distributor.isClaimed(wallet1.address)).to.eq(false);
        await distributor.claim(wallet0.address, 100, proof0);
        expect(await distributor.isClaimed(wallet0.address)).to.eq(true);
        expect(await distributor.isClaimed(wallet1.address)).to.eq(false);
      });

      it("cannot allow two claims", async () => {
        const proof0 = generator.tree.getHexProof(
          generator.generateLeaf(wallet0.address, BigNumber.from(100))
        );
        await distributor.claim(wallet0.address, 100, proof0);
        await expect(
          distributor.claim(wallet0.address, 100, proof0)
        ).to.be.revertedWith("AlreadyClaimed()");
      });

      it("cannot claim more than once: 0 and then 1", async () => {
        await distributor.claim(
          wallet0.address,
          100,
          generator.tree.getHexProof(
            generator.generateLeaf(wallet0.address, BigNumber.from(100))
          )
        );
        await distributor.claim(
          wallet1.address,
          101,
          generator.tree.getHexProof(
            generator.generateLeaf(wallet1.address, BigNumber.from(101))
          )
        );

        await expect(
          distributor.claim(
            wallet0.address,
            100,
            generator.tree.getHexProof(
              generator.generateLeaf(wallet0.address, BigNumber.from(100))
            )
          )
        ).to.be.revertedWith("AlreadyClaimed()");
      });

      it("cannot claim more than once: 1 and then 0", async () => {
        await distributor.claim(
          wallet1.address,
          101,
          generator.tree.getHexProof(
            generator.generateLeaf(wallet1.address, BigNumber.from(101))
          )
        );
        await distributor.claim(
          wallet0.address,
          100,
          generator.tree.getHexProof(
            generator.generateLeaf(wallet0.address, BigNumber.from(100))
          )
        );

        await expect(
          distributor.claim(
            wallet1.address,
            101,
            generator.tree.getHexProof(
              generator.generateLeaf(wallet1.address, BigNumber.from(101))
            )
          )
        ).to.be.revertedWith("AlreadyClaimed()");
      });

      it("cannot claim for address other than proof", async () => {
        const proof0 = generator.tree.getHexProof(
          generator.generateLeaf(wallet0.address, BigNumber.from(100))
        );
        await expect(
          distributor.claim(wallet1.address, 101, proof0)
        ).to.be.revertedWith("NotEligible");
      });

      it("cannot claim more than proof", async () => {
        const proof0 = generator.tree.getHexProof(
          generator.generateLeaf(wallet0.address, BigNumber.from(100))
        );
        await expect(
          distributor.claim(wallet0.address, 101, proof0)
        ).to.be.revertedWith("NotEligible");
      });

      it("cannot claim more than proof", async () => {
        const proof0 = generator.tree.getHexProof(
          generator.generateLeaf(wallet0.address, BigNumber.from(100))
        );
        await expect(
          distributor.claim(wallet0.address, 99, proof0)
        ).to.be.revertedWith("NotEligible");
      });
    });

    describe("larger tree", () => {
      let generator: Generator;
      let distributor: MerkleDistributorVesting;

      beforeEach("deploy", async () => {
        generator = new Generator(
          wallets.reduce(
            (acc, wallet, ix) => ({
              ...acc,
              [wallet.address]: BigNumber.from(100 + ix + 1)
            }),
            {} as Record<string, BigNumberish>
          ),
          0
        );
        distributor = await distributorFactory.deploy(
          token.address,
          generator.tree.getHexRoot(),
          0,
          0
        );
        await distributor.deployed();
        await token.setBalance(distributor.address, 2010);
      });

      it("claim address 4", async () => {
        const proof = generator.tree.getHexProof(
          generator.generateLeaf(wallets[4].address, BigNumber.from(105))
        );
        await expect(distributor.claim(wallets[4].address, 105, proof))
          .to.emit(distributor, "Claimed")
          .withArgs(wallets[4].address, percentOf(30, 105));
      });

      it("claim address 9", async () => {
        const proof = generator.tree.getHexProof(
          generator.generateLeaf(wallets[9].address, BigNumber.from(110))
        );
        await expect(distributor.claim(wallets[9].address, 110, proof))
          .to.emit(distributor, "Claimed")
          .withArgs(wallets[9].address, percentOf(30, 110));
      });
    });

    describe("18 decimals", () => {
      let generator: Generator;
      let distributor: MerkleDistributorVesting;

      before(async () => {
        token = await tokenFactory.deploy("Eazi", "EAZI", 18);
        await token.deployed();
      });

      beforeEach("deploy", async () => {
        generator = new Generator(
          wallets.reduce(
            (acc, wallet, ix) => ({
              ...acc,
              [wallet.address]: 100 + ix + 1
            }),
            {} as Record<string, BigNumberish>
          ),
          18
        );

        distributor = await distributorFactory.deploy(
          token.address,
          generator.tree.getHexRoot(),
          0,
          0
        );

        await distributor.deployed();
        await token.setBalance(
          distributor.address,
          ethers.utils.parseEther("2010")
        );
      });

      it("claim address 4", async () => {
        const proof = generator.tree.getHexProof(
          generator.generateLeaf(
            wallets[4].address,
            ethers.utils.parseEther("105")
          )
        );
        await expect(
          distributor.claim(
            wallets[4].address,
            ethers.utils.parseEther("105"),
            proof
          )
        )
          .to.emit(distributor, "Claimed")
          .withArgs(
            wallets[4].address,
            percentOf(30, ethers.utils.parseEther("105"))
          );

        expect(await token.balanceOf(wallets[4].address)).to.eq(
          percentOf(30, ethers.utils.parseEther("105"))
        );
      });

      it("claim address 9", async () => {
        const proof = generator.tree.getHexProof(
          generator.generateLeaf(
            wallets[9].address,
            ethers.utils.parseEther("110")
          )
        );
        await expect(
          distributor.claim(
            wallets[9].address,
            ethers.utils.parseEther("110"),
            proof
          )
        )
          .to.emit(distributor, "Claimed")
          .withArgs(
            wallets[9].address,
            percentOf(30, ethers.utils.parseEther("110"))
          );
      });
    });

    describe("client-side proof verification", async () => {
      let generator: Generator;
      let distributor: MerkleDistributorVesting;

      before(async () => {
        generator = new Generator(
          {
            [wallet0.address]: BigNumber.from(100)
          },
          0
        );
      });

      it("proof verification works", () => {
        const root = Buffer.from(generator.tree.getHexRoot().slice(2), "hex");
        const node = generator.generateLeaf(
          wallet0.address,
          BigNumber.from(100)
        );
        const proof = generator.tree
          .getHexProof(node)
          .map((el) => Buffer.from(el.slice(2), "hex"));

        const validProof = generator.tree.verify(proof, node, root);
        expect(validProof).to.be.true;
      });

      beforeEach("deploy", async () => {
        distributor = await distributorFactory.deploy(
          token.address,
          generator.tree.getHexRoot(),
          0,
          0
        );
        await distributor.deployed();
        await token.setBalance(distributor.address, constants.MaxUint256);
      });
    });
  });

  describe("Parse Allocation Records And Map to Claims", () => {
    let claims: {
      [account: string]: {
        amount: string;
        proof: string[];
      };
    };
    let generator: Generator;
    let distributor: MerkleDistributorVesting;

    before(async () => {
      generator = new Generator(
        {
          [wallet0.address]: 200,
          [wallet1.address]: 300,
          [wallets[2].address]: 250
        },
        0
      );
    });

    beforeEach("deploy", async () => {
      const {
        claims: innerClaims,
        merkleRoot,
        tokenTotal
      } = generator.generateClaims();
      expect(tokenTotal).to.eq("0x02ee"); // 750
      claims = innerClaims;
      distributor = await distributorFactory.deploy(
        token.address,
        merkleRoot,
        0,
        0
      );
      await distributor.deployed();
      await token.setBalance(distributor.address, tokenTotal);
    });

    it("check the proofs is as expected", () => {
      expect(claims).to.deep.eq({
        [wallet0.address]: {
          amount: "0xc8",
          proof: generator.tree.getHexProof(
            generator.generateLeaf(wallet0.address, BigNumber.from(200))
          )
        },
        [wallet1.address]: {
          amount: "0x012c",
          proof: generator.tree.getHexProof(
            generator.generateLeaf(wallet1.address, BigNumber.from(300))
          )
        },
        [wallets[2].address]: {
          amount: "0xfa",
          proof: generator.tree.getHexProof(
            generator.generateLeaf(wallets[2].address, BigNumber.from(250))
          )
        }
      });
    });

    it("all claims work exactly once", async () => {
      for (let account in claims) {
        const claim = claims[account];
        await expect(distributor.claim(account, claim.amount, claim.proof))
          .to.emit(distributor, "Claimed")
          .withArgs(account, percentOf(30, claim.amount));
        await expect(
          distributor.claim(account, claim.amount, claim.proof)
        ).to.be.revertedWith("AlreadyClaimed()");
      }
      expect(await token.balanceOf(distributor.address)).to.eq(0);
    });
  });

  describe("paused, startsFrom & deadline", () => {
    let generator: Generator;
    let startTimestamp: number;
    let vestingWallet: VestingWallet;
    let distributor: MerkleDistributorVesting;
    let days = (num: number) => num * 24 * 60 * 60;

    before(async () => {
      generator = new Generator(
        {
          [wallet0.address]: BigNumber.from(100),
          [wallet1.address]: BigNumber.from(101)
        },
        0
      );

      token = await tokenFactory.deploy("Eazi", "EAZI", 0);

      let block = await ethers.provider.getBlock("latest");
      startTimestamp = block.timestamp + days(1);

      distributor = await distributorFactory.deploy(
        token.address,
        generator.tree.getHexRoot(),
        startTimestamp,
        startTimestamp + days(7)
      );
      await token.deployed();
      await distributor.deployed();
      await token.setBalance(distributor.address, 201);
    });

    it("can't claim before Start Time", async () => {
      const proof0 = generator.tree.getHexProof(
        generator.generateLeaf(wallet0.address, BigNumber.from(100))
      );

      await expect(
        distributor.claim(wallet0.address, 100, proof0)
      ).to.be.revertedWith("ActionPaused()");

      await ethers.provider.send("evm_increaseTime", [days(1)]);
      await ethers.provider.send("evm_mine", []);
    });

    it("can't claim when paused", async () => {
      const proof1 = generator.tree.getHexProof(
        generator.generateLeaf(wallet0.address, BigNumber.from(100))
      );

      await distributor.pause();

      await expect(
        distributor.claim(wallet0.address, 100, proof1)
      ).to.be.revertedWith("Pausable: paused");

      await distributor.unPause();

      const claimTx = await distributor.claim(wallet0.address, 100, proof1);
      const receipt = await claimTx.wait();
      const args = receipt.events?.find(
        ({ event }) => event === "VestingWalletCreated"
      )?.args;
      vestingWallet = VestingWallet__factory.connect(
        args?.vestingWallet,
        wallet0
      );
      expect(claimTx)
        .to.emit(distributor, "Claimed")
        .withArgs(wallet0.address, percentOf(30, 100));
    });

    it("can't withdraw unclaimed tokens before deadline", async () => {
      await expect(distributor.withdrawUnclaimed()).to.revertedWith(
        "ActionPaused()"
      );
    });

    it("can't claim after Deadline", async () => {
      let block = await ethers.provider.getBlock("latest");

      await ethers.provider.send("evm_increaseTime", [
        block.timestamp - startTimestamp + days(7)
      ]);
      await ethers.provider.send("evm_mine", []);

      const proof1 = generator.tree.getHexProof(
        generator.generateLeaf(wallet0.address, BigNumber.from(100))
      );
      await expect(
        distributor.claim(wallet0.address, 100, proof1)
      ).to.be.revertedWith("PastDeadline()");
    });

    it("withdraw unclaimed tokens", async () => {
      await ethers.provider.send("evm_increaseTime", [days(2)]);
      await ethers.provider.send("evm_mine", []);

      const merkleToken = TestERC20__factory.connect(
        await distributor.token(),
        wallet0
      );
      const distributorBalance = await merkleToken.balanceOf(
        distributor.address
      );

      //wallets[2] didn't claim, so there should be unclaimed tokens
      await expect(distributor.withdrawUnclaimed()).to.emit(
        distributor,
        "UnclaimedWithdrawn"
      );

      expect(await merkleToken.balanceOf(wallet0.address)).to.eq(
        distributorBalance.add(percentOf(30, 100))
      );
    });

    it("confirms VestingWallet details", async () => {
      const merkleToken = TestERC20__factory.connect(
        await distributor.token(),
        wallet0
      );
      const wallet0Balance = await merkleToken.balanceOf(vestingWallet.address);
      expect(await vestingWallet.beneficiary()).to.eq(wallet0.address);

      expect(wallet0Balance).to.eq(percentOf(70, 100));
    });
  });
});
