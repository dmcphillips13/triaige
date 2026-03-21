// Detects Playwright configuration and checks for JSON reporter setup.
// Does NOT auto-modify config — prints suggestions for the user to apply.

import { existsSync, readFileSync } from "node:fs";
import chalk from "chalk";

const CONFIG_FILES = [
  "playwright.config.ts",
  "playwright.config.js",
  "playwright.config.mts",
  "playwright.config.mjs",
];

export interface PlaywrightCheckResult {
  configPath: string | null;
  jsonReporterConfigured: boolean;
}

export function detectPlaywrightConfig(): PlaywrightCheckResult {
  for (const file of CONFIG_FILES) {
    if (existsSync(file)) {
      const content = readFileSync(file, "utf-8");
      const hasJsonReporter =
        content.includes('"json"') || content.includes("'json'");
      const hasOutputFile =
        content.includes("test-results/results.json") ||
        content.includes("test-results\\\\results.json");

      return {
        configPath: file,
        jsonReporterConfigured: hasJsonReporter && hasOutputFile,
      };
    }
  }

  return { configPath: null, jsonReporterConfigured: false };
}

export function printPlaywrightStatus(result: PlaywrightCheckResult): void {
  const ok = chalk.green("✓");
  const fail = chalk.red("✗");
  const warn = chalk.yellow("!");

  console.log();
  console.log(chalk.bold("Playwright Configuration"));
  console.log();

  if (!result.configPath) {
    console.log(`  ${warn} No Playwright config found`);
    console.log(
      "    Triaige works with Playwright test results. Add a config when you're ready."
    );
    return;
  }

  console.log(`  ${ok} Found: ${chalk.cyan(result.configPath)}`);

  if (result.jsonReporterConfigured) {
    console.log(`  ${ok} JSON reporter configured`);
  } else {
    console.log(`  ${fail} JSON reporter not detected`);
    console.log();
    console.log(
      `    Triaige needs the JSON reporter to parse test results.`
    );
    console.log(
      `    Add this to your ${chalk.cyan(result.configPath)}:`
    );
    console.log();
    console.log(
      chalk.dim(
        '    reporter: [["list"], ["json", { outputFile: "test-results/results.json" }]],'
      )
    );
    console.log();
  }
}
