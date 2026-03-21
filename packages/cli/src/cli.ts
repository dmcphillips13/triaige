// Entry point for the Triaige CLI.
// Routes subcommands — currently only `init` is supported.

import { createRequire } from "node:module";
import { init } from "./init.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json");

const args = process.argv.slice(2);

if (args.includes("--version") || args.includes("-v")) {
  console.log(pkg.version);
  process.exit(0);
}

if (args.includes("--help") || args.includes("-h") || args.length === 0) {
  console.log(`
  triaige v${pkg.version}

  Usage:
    triaige init    Set up Triaige in your repo

  Options:
    --version, -v   Show version
    --help, -h      Show this help
  `);
  process.exit(0);
}

const command = args[0];

if (command === "init") {
  init().catch((err) => {
    console.error("\nSetup failed:", err.message);
    process.exit(1);
  });
} else {
  console.error(`Unknown command: ${command}`);
  console.error('Run "triaige --help" for usage.');
  process.exit(1);
}
