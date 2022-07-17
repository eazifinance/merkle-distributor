import { generateMerkleRoot } from "./utils/helpers";

(async () => {
  // To trim first 2 elements
  const arg = process.argv.slice(2);

  const withProofs = arg[0] === "true" || false;
  const start = Number(arg[1] || 0);
  const stop = Number(arg[2] || 0);

  await generateMerkleRoot(undefined, true, withProofs, start, stop);
})();
