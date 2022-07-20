// This file contains the logic used to generate the chunks of data.
import {
  appendFileSync,
  createReadStream,
  existsSync,
  readdir,
  readdirSync,
  readFileSync,
  writeFileSync
} from "fs";
import { extname, join } from "path";
import { throwErrorAndExit } from "./utils/helpers";

interface IClaims {
  [account: string]: {
    amount: string;
    proof: string[];
  };
}
let allClaims: IClaims = {};

const mergeClaims = () => {
  const dir = "./claims";
  // Get directory content
  const fileNames = readdirSync(dir);
  // Loop fileNames array
  for (let i = 0; i < fileNames.length; i++) {
    const filename = fileNames[i];
    const extension = extname(filename);

    // Get only .json files
    if (extension == ".json") {
      try {
        let pulledClaims: IClaims = JSON.parse(
          readFileSync(`${dir}/${filename}`, "utf-8")
        );

        allClaims = { ...pulledClaims, ...allClaims };
      } catch (err) {
        console.error(err);
      }
    }
  }

  // // Collect and save claims
  // writeFileSync(
  //   // Output to claims.json
  //   claimsOutputPath,
  //   // Claims and Proofs in string formats
  //   JSON.stringify(claims)
  // );
};

const allKeysExist = (
  allocationFilename: string = "migrators-records.json"
) => {
  const allocationPath: string = join(__dirname, `../${allocationFilename}`);

  // Check if config exists
  if (!existsSync(allocationPath)) {
    throwErrorAndExit(`Missing ${allocationFilename}. Please add.`);
  }

  // Read allocation JSON
  const airdropRecords: Record<string, number> = JSON.parse(
    readFileSync(allocationPath, "utf-8")
  );

  for (const [tmpAddress, tokens] of Object.entries(airdropRecords)) {
    if (!allClaims[tmpAddress]) {
      throw new Error(`Claim for ${tmpAddress} not found`);
    }
    // throw new Error(`Found Duplicate address: ${address}`);
  }
};

mergeClaims();
allKeysExist();

const sortedAddresses: string[] = Object.keys(allClaims);
sortedAddresses.sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1));

const DESIRED_COHORT_SIZE = 101;

type LastAddress = string;
const addressChunks: { [firstAddress: string]: LastAddress } = {};

for (let i = 0; i < sortedAddresses.length; i += DESIRED_COHORT_SIZE) {
  const lastIndex = Math.min(
    i + DESIRED_COHORT_SIZE - 1,
    sortedAddresses.length - 1
  );
  addressChunks[sortedAddresses[i].toLowerCase()] =
    sortedAddresses[lastIndex].toLowerCase();
  const chunkPath: string = join(
    __dirname,
    `../chunks/${sortedAddresses[i].toLowerCase()}.json`
  );

  writeFileSync(
    chunkPath,
    JSON.stringify(
      sortedAddresses.slice(i, lastIndex + 1).reduce((claims, addr) => {
        claims[addr] = allClaims[addr];
        return claims;
      }, <IClaims>{})
    )
  );
}

writeFileSync(`./mapping.json`, JSON.stringify(addressChunks));
