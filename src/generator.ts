import fs, { existsSync } from "fs"; // Filesystem
import path from "path"; // Path
import keccak256 from "keccak256"; // Keccak256 hashing
import MerkleTree from "merkletreejs"; // MerkleTree.js
import { logger } from "./utils/logger"; // Logging
import { getAddress, parseUnits, solidityKeccak256 } from "ethers/lib/utils"; // Ethers utils
import { BigNumberish } from "@ethersproject/bignumber";
import { BigNumber } from "ethers";

interface IClaims {
  [account: string]: {
    amount: string;
    proof: string[];
  };
}
// This is the blob that gets distributed and pinned to IPFS.
// It is completely sufficient for recreating the entire merkle tree.
// Anyone can verify that all air drops are included in the tree,
// and the tree has no additional distributions.
interface IMerkleDistributorInfo {
  merkleRoot: string;
  tokenTotal: string;
  claims: IClaims;
}

// Airdrop recipient addresses and scaled token values
type AirdropRecipient = {
  // Recipient address
  address: string;
  // Scaled-to-decimals token value
  value: string;
};

export default class Generator {
  tree: MerkleTree;
  tokenTotal: BigNumber;
  recipients: AirdropRecipient[] = []; // Airdrop recipients
  leaves: { [account: string]: Buffer } = {};

  /**
   * Setup generator
   * @param {number} decimals of token
   * @param {Record<string, BigNumberish>} airdrop address to token claim mapping
   */
  constructor(
    airdrop: Record<string, BigNumberish> = {},
    decimals: number = 18
  ) {
    console.log("Reading records");

    this.tokenTotal = BigNumber.from(0);
    // For each airdrop entry
    for (const [tmpAddress, tokens] of Object.entries(airdrop)) {
      // Checksum address
      const address = getAddress(tmpAddress);
      // Scaled number of tokens claimable by recipient
      const value = parseUnits(tokens.toString(), decimals).toHexString();
      //TODO confirm if hex is lighter than toString

      // Push:
      this.recipients.push({ address, value });

      if (this.leaves[address]) {
        throw new Error(`Found Duplicate address: ${address}`);
      }

      // Generate leafs
      this.leaves[address] = this.generateLeaf(address, value);
      this.tokenTotal = this.tokenTotal.add(value);
    }

    logger.info("Generating Merkle tree.");

    // Generate merkle tree
    this.tree = new MerkleTree(
      // Generate leafs
      this.recipients.map(({ address }) => this.leaves[address]),
      // Hashing function
      keccak256,
      { sortPairs: true }
    );
  }

  /**
   * Generate Merkle Tree leaf from address and value
   * @param {string} address of airdrop claimee
   * @param {BigNumberish} value of airdrop tokens to claimee
   * @returns {Buffer} Merkle Tree node
   */
  generateLeaf(address: string, value: BigNumberish): Buffer {
    return Buffer.from(
      // Hash in appropriate Merkle format
      solidityKeccak256(["address", "uint256"], [address, value]).slice(2),
      "hex"
    );
  }

  process(
    saveToFile: boolean = false,
    bufferOutFilename: string = "../merkle.json"
  ): string {
    // Output file path
    const bufferOutputPath: string = path.join(__dirname, bufferOutFilename);

    // Collect and log merkle root
    const merkleRoot: string = this.tree.getHexRoot();
    logger.info(`Generated Merkle root: ${merkleRoot}`);

    if (saveToFile) {
      // Collect and save merkle tree + root
      fs.writeFileSync(
        // Output to merkle.json
        bufferOutputPath,
        // Root + full tree
        JSON.stringify({
          root: merkleRoot,
          tokenTotal: this.tokenTotal.toHexString()
        })
      );
      logger.info(
        `Generated merkle tree and root saved to ${bufferOutputPath}`
      );
    }
    return this.tree.getHexRoot();
  }

  generateClaims(
    start: number = 0,
    stop: number = 0,
    saveToFile: boolean = false,
    claimsOutFilename: string = "../claims/claims"
  ) {
    const claimsOutputPath: string = path.join(__dirname, claimsOutFilename);
    logger.info(
      "Generating readable proofs for each claims... Might take a while..."
    );

    let claims: IClaims = {};
    console.time("getHexProof");
    let startIndex = Math.max(0, start);
    let stopIndex =
      stop === 0
        ? this.recipients.length
        : Math.min(this.recipients.length, stop);

    for (let index = startIndex; index < stopIndex; index++) {
      const { address, value } = this.recipients[index];

      claims[address] = {
        amount: value,
        proof: this.tree.getHexProof(this.leaves[address])
      };

      if (index > 1 && index % 10 == 0) {
        console.log("Index :", index);
        console.timeEnd("loop");

        if (saveToFile) {
          let existingClaims: IClaims = {};

          if (index % 100 == 0) {
            startIndex = index;
          }

          const currClaimsOutputPath = `${claimsOutputPath}-${startIndex}.json`;
          if (existsSync(currClaimsOutputPath)) {
            existingClaims = JSON.parse(
              fs.readFileSync(currClaimsOutputPath, "utf-8")
            );
          }

          const newClaims: IClaims = { ...existingClaims, ...claims };

          // Collect and save merkle tree + root
          fs.writeFileSync(
            // Output to claims.json
            currClaimsOutputPath,
            // Claims and Proofs in string formats
            JSON.stringify(newClaims)
          );
          //clear claims
          claims = {};
        }
        console.time("loop");
      }
    }

    console.timeEnd("getHexProof");

    // const jsonOutput: IMerkleDistributorInfo = {
    //   claims: claims
    // };

    logger.info(
      `Generated readable proofs for each claims to ${claimsOutputPath}.`
    );

    return {
      merkleRoot: this.tree.getHexRoot(),
      tokenTotal: this.tokenTotal.toHexString(),
      claims
    };
  }
}
