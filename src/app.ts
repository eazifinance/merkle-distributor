import { generateMerkleRoot } from "./utils/helpers";

// env & Config file path
const generateProofs = process.env.GENERATE_PROOFS === "true" || false;

(async () => {
  await generateMerkleRoot(undefined, true, generateProofs);
})();
