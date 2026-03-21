// Generates workflow files and scripts from templates.
// Templates are shipped with the npm package in the templates/ directory.

import { mkdirSync, writeFileSync, readFileSync, chmodSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import chalk from "chalk";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getTemplatesDir(): string {
  // In built output: dist/cli.js → templates/ is at ../templates/
  // tsup bundles to dist/cli.js, so templates are at packages/cli/templates/
  return join(__dirname, "..", "templates");
}

function readTemplate(name: string): string {
  return readFileSync(join(getTemplatesDir(), name), "utf-8");
}

interface TemplateContext {
  nodeVersion: string;
  buildCommand: string;
  packageManager: "npm" | "yarn" | "pnpm";
}

function getInstallCommand(pm: "npm" | "yarn" | "pnpm"): string {
  switch (pm) {
    case "pnpm":
      return "pnpm install --frozen-lockfile";
    case "yarn":
      return "yarn install --frozen-lockfile";
    default:
      return "npm ci";
  }
}

function getCacheKey(pm: "npm" | "yarn" | "pnpm"): string {
  return pm;
}

export function generateFiles(context: TemplateContext): void {
  console.log();
  console.log(chalk.bold("Generating files"));
  console.log();

  // Ensure directories exist
  mkdirSync(".github/workflows", { recursive: true });
  mkdirSync("scripts", { recursive: true });

  // Visual regression workflow (templatized)
  let workflow = readTemplate("visual-regression.yml");
  workflow = workflow.replace(/\{\{NODE_VERSION\}\}/g, context.nodeVersion);
  workflow = workflow.replace(/\{\{BUILD_COMMAND\}\}/g, context.buildCommand);
  workflow = workflow.replace(
    /\{\{INSTALL_COMMAND\}\}/g,
    getInstallCommand(context.packageManager)
  );
  workflow = workflow.replace(
    /\{\{CACHE_KEY\}\}/g,
    getCacheKey(context.packageManager)
  );

  writeFileSync(".github/workflows/visual-regression.yml", workflow);
  console.log(
    `  ${chalk.green("✓")} .github/workflows/visual-regression.yml`
  );

  // Close PR runs workflow (verbatim)
  const closeWorkflow = readTemplate("close-pr-runs.yml");
  writeFileSync(".github/workflows/close-pr-runs.yml", closeWorkflow);
  console.log(`  ${chalk.green("✓")} .github/workflows/close-pr-runs.yml`);

  // Post-failures script (verbatim, executable)
  const script = readTemplate("post-failures.sh");
  writeFileSync("scripts/post-failures.sh", script);
  chmodSync("scripts/post-failures.sh", 0o755);
  console.log(`  ${chalk.green("✓")} scripts/post-failures.sh ${chalk.dim("(chmod +x)")}`);

  console.log();
}
