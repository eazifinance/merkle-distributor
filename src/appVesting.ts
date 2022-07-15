import { generateMerkleRoot } from "./utils/helpers";

// env & Config file path
const generateProofs = process.env.GENERATE_PROOFS === "true" || false;

(async () => {
  await generateMerkleRoot("../vesting-records", true, generateProofs);
})();
