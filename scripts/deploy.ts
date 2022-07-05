// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers } from "hardhat";
import { generateMerkleRoot, throwErrorAndExit } from "../src/utils/helpers";

async function main() {
  const days = (num: number) => num * 24 * 60 * 60;

  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');

  // We get the contract to deploy
  const MigratorMerkleDistributor = await ethers.getContractFactory(
    "MerkleDistributor"
  );

  const migratorsMerkleRoot = await generateMerkleRoot();

  const coreController = "";
  const block = await ethers.provider.getBlock("latest");

  if (!coreController) {
    throw new Error("Corecontroller not set");
  }

  const migratorMerkleDistributor = await MigratorMerkleDistributor.deploy(
    "0xb088fe9f5ddd43f45dc1d10b4aa3e83c4b69e23c",
    migratorsMerkleRoot,
    block.timestamp + days(7),
    block.timestamp + days(7) + days(15),
    coreController,
    ethers.utils.parseUnits("50", 8)
  );

  await migratorMerkleDistributor.deployed();

  console.log(
    "MigratorMerkleDistributor deployed to:",
    migratorMerkleDistributor.address
  );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch(throwErrorAndExit);
