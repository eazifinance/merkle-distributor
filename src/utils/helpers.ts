import { join } from "path";
import { existsSync, readFileSync } from "fs";
import Generator from "../generator"; // Generator

/**
 * Throws error and exists process
 * @param {string} erorr to log
 */
export function throwErrorAndExit(error: string): void {
  console.error(error);
  process.exit(1);
}

export async function generateMerkleRoot(
  allocationFilename: string = "../migrators-records.json",
  saveToFile?: boolean,
  withProofs?: boolean,
  start: number = 0,
  stop: number = 0
) {
  const allocationPath: string = join(__dirname, `../${allocationFilename}`);

  // Check if config exists
  if (!existsSync(allocationPath)) {
    throwErrorAndExit(`Missing ${allocationFilename}. Please add.`);
  }

  // Read allocation JSON
  const allocationJSON: Buffer = readFileSync(allocationPath);
  const airdropRecords: Record<string, number> = JSON.parse(
    allocationJSON.toString()
  );

  // Initialize and call generator
  const generator = new Generator(airdropRecords);
  const merkleRoot = generator.process(saveToFile);
  if (withProofs) {
    generator.generateClaims(start, stop, saveToFile);
  }
  return merkleRoot;
}
