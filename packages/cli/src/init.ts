// Main init orchestrator — runs all setup steps sequentially.
// Each step is independent and records its result for the final summary.

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { password, input, confirm } from "@inquirer/prompts";
import chalk from "chalk";
import {
  checkPrerequisites,
  printPrereqStatus,
} from "./utils/prerequisites.js";
import { setSecrets } from "./utils/secrets.js";
import {
  detectPlaywrightConfig,
  printPlaywrightStatus,
} from "./utils/playwright.js";
import { generateFiles } from "./utils/templates.js";
import { setupBranchProtection } from "./utils/branch-protection.js";
import { generateBaselinesInCI } from "./utils/baselines.js";
import {
  checkGitHubApp,
  printAppStatus,
} from "./utils/github-app.js";
import { printSummary, type SetupStatus } from "./utils/validation.js";

const DEFAULT_RUNNER_URL = "https://triaige-runner.onrender.com";

async function validateRunnerConnection(
  url: string,
  apiKey: string
): Promise<boolean> {
  try {
    const response = await fetch(`${url}/health`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    return response.ok;
  } catch {
    return false;
  }
}

function detectNodeVersion(): string {

  // Check .nvmrc
  if (existsSync(".nvmrc")) {
    const version = readFileSync(".nvmrc", "utf-8").trim().replace(/^v/, "");
    const major = version.split(".")[0];
    if (major && !isNaN(Number(major))) return major;
  }

  // Check package.json engines
  if (existsSync("package.json")) {
    try {
      const pkg = JSON.parse(readFileSync("package.json", "utf-8"));
      const engines = pkg.engines?.node;
      if (engines) {
        const match = engines.match(/(\d+)/);
        if (match) return match[1];
      }
    } catch {
      // ignore parse errors
    }
  }

  return "20";
}

export async function init(): Promise<void> {
  console.log();
  console.log(chalk.bold.cyan("  triaige init"));
  console.log(chalk.dim("  Set up Triaige visual regression triage in your repo"));

  // Step 1: Prerequisites
  const prereqs = checkPrerequisites();
  printPrereqStatus(prereqs);

  if (!prereqs.repoContext) {
    console.log(
      chalk.red(
        "This command must be run inside a Git repository with a GitHub remote."
      )
    );
    process.exit(1);
  }

  if (!prereqs.ghAvailable) {
    const continueWithout = await confirm({
      message:
        "GitHub CLI is not available. Continue with manual setup instructions?",
      default: true,
    });
    if (!continueWithout) {
      console.log("Install the GitHub CLI and try again: https://cli.github.com");
      process.exit(0);
    }
  }

  // Step 2: Credentials
  console.log(chalk.bold("Triaige Credentials"));
  console.log();
  console.log(
    chalk.dim(
      "  Copy your API key from the Triaige dashboard:"
    )
  );
  console.log(
    chalk.dim(
      `  https://triaige-dashboard.vercel.app/repos/${prereqs.repoContext.owner}/${prereqs.repoContext.repo}/settings`
    )
  );
  console.log();

  const apiKey = await password({
    message: "Triaige API key:",
    mask: "*",
  });

  if (!apiKey) {
    console.log(chalk.red("API key is required."));
    process.exit(1);
  }

  const runnerUrl = DEFAULT_RUNNER_URL;

  // Validate connection
  console.log();
  console.log("Validating connection...");
  const connected = await validateRunnerConnection(runnerUrl, apiKey);

  if (connected) {
    console.log(`  ${chalk.green("✓")} Connected to runner`);
  } else {
    console.log(`  ${chalk.red("✗")} Could not connect to runner`);
    const continueAnyway = await confirm({
      message:
        "Connection failed. The runner may be cold-starting. Continue anyway?",
      default: true,
    });
    if (!continueAnyway) process.exit(1);
  }

  // Step 3: Set GitHub secrets
  const secretsResult = setSecrets(
    apiKey,
    runnerUrl,
    prereqs.ghAvailable
  );

  // Step 4: Detect Playwright
  const playwrightResult = detectPlaywrightConfig();
  printPlaywrightStatus(playwrightResult);

  // Step 5: Build command
  console.log(chalk.bold("Application Setup"));
  console.log();

  const buildCommand = await input({
    message:
      "What command builds your app? (Playwright's webServer config handles starting it)",
    default: "npm run build",
  });

  // Step 6: Detect Node version
  const nodeVersion = detectNodeVersion();
  console.log(`  ${chalk.green("✓")} Node version: ${chalk.cyan(nodeVersion)}`);
  console.log(
    `  ${chalk.green("✓")} Package manager: ${chalk.cyan(prereqs.packageManager)}`
  );

  const installCommand =
    prereqs.packageManager === "pnpm"
      ? "pnpm install --frozen-lockfile"
      : prereqs.packageManager === "yarn"
        ? "yarn install --frozen-lockfile"
        : "npm ci";
  const cacheKey = prereqs.packageManager;

  // Step 7: Generate workflow files
  generateFiles({
    nodeVersion,
    buildCommand,
    packageManager: prereqs.packageManager,
  });

  // Step 8: Commit and push generated files (needed before baseline generation)
  if (prereqs.ghAvailable) {
    try {
      execSync("git add .github/workflows/ scripts/", { stdio: "pipe" });
      execSync('git commit -m "Add Triaige CI integration via triaige init"', {
        stdio: "pipe",
      });
      execSync("git push", { stdio: "pipe" });
      console.log(`  ${chalk.green("✓")} Committed and pushed workflow files`);
    } catch {
      console.log(
        `  ${chalk.yellow("!")} Could not push workflow files — commit and push manually`
      );
    }
  }

  // Step 9: Generate baselines in CI (optional but recommended)
  let baselinesGenerated = false;
  if (prereqs.ghAvailable && playwrightResult.configPath) {
    const generateBaselines = await confirm({
      message:
        "Generate initial baselines in CI? (recommended — ensures baselines match the CI environment)",
      default: true,
    });

    if (generateBaselines) {
      baselinesGenerated = await generateBaselinesInCI({
        nodeVersion,
        installCommand,
        buildCommand,
        cacheKey,
        repoFullName: prereqs.repoContext.fullName,
      });
    } else {
      console.log(
        chalk.dim(
          "  Skipped. Generate baselines before opening your first PR."
        )
      );
    }
  }

  // Step 10: Branch protection (after baselines, so pushes aren't blocked)
  let branchProtectionSet = false;
  if (prereqs.ghAvailable) {
    console.log();
    console.log(chalk.bold("Merge Gate"));
    console.log();

    const setupProtection = await confirm({
      message:
        'Add "Triaige Visual Regression" as a required status check? (enables merge gate)',
      default: true,
    });

    if (setupProtection) {
      branchProtectionSet = setupBranchProtection(
        prereqs.repoContext.fullName
      );
    } else {
      console.log(chalk.dim("  Skipped branch protection setup"));
    }
  }

  // Step 11: Check GitHub App via runner
  const appResult = await checkGitHubApp(
    prereqs.repoContext.fullName,
    runnerUrl,
    apiKey
  );
  printAppStatus(appResult);

  // Step 12: Summary
  const status: SetupStatus = {
    secretsSet: secretsResult.success,
    workflowsGenerated: true,
    scriptGenerated: true,
    playwrightConfigFound: !!playwrightResult.configPath,
    jsonReporterConfigured: playwrightResult.jsonReporterConfigured,
    baselinesGenerated,
    branchProtectionSet,
    githubAppInstalled: appResult.installed,
  };

  printSummary(status);
}
