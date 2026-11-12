#!/usr/bin/env node
"use strict";
const Packet = require("./lib/st-review-packet.cjs");
function main(args) {
  if (args.length === 1 && args[0] === "--help") {
    console.log(
      "node scripts/build-st-review-packet.cjs --manifest /path/manifest.json --out /fresh/directory-outside-git",
    );
    return;
  }
  if (args.length !== 4 || args[0] !== "--manifest" || args[2] !== "--out")
    throw Error("Expected --manifest FILE --out NEW_DIRECTORY (see --help)");
  console.log(JSON.stringify(Packet.build(args[1], args[3]), null, 2));
}
if (require.main === module)
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error.stack);
    process.exitCode = 1;
  }
module.exports = { main };
