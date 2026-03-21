// Generates initial baselines via a one-time CI workflow run.
//
// Creates a temporary update-snapshots workflow, commits and pushes it,
// triggers the workflow, waits for completion, pulls the CI-generated
// baselines, and removes the workflow file. This ensures baselines are
// generated on Linux (matching CI) rather than the developer's local OS.

import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import chalk from "chalk";

const WORKFLOW_PATH = ".github/workflows/update-snapshots.yml";

function generateUpdateSnapshotsWorkflow(
  nodeVersion: string,
  installCommand: string,
  buildCommand: string,
  cacheKey: string
): string {
  return `name: Update Snapshots

on:
  workflow_dispatch:

permissions:
  contents: write

jobs:
  update-snapshots:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${nodeVersion}
          cache: ${cacheKey}

      - run: ${installCommand}

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium

      - run: ${buildCommand}

      - name: Generate snapshots
        run: npx playwright test --update-snapshots

      - name: Commit updated snapshots
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add tests/
          if git diff --cached --quiet; then
            echo "No snapshot changes to commit"
          else
            git commit -m "Update baseline snapshots from CI"
            git push
          fi
`;
}

function run(cmd: string): string {
  return execSync(cmd, { stdio: "pipe" }).toString().trim();
}

function runSilent(cmd: string): boolean {
  try {
    execSync(cmd, { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

export async function generateBaselinesInCI(opts: {
  nodeVersion: string;
  installCommand: string;
  buildCommand: string;
  cacheKey: string;
  repoFullName: string;
}): Promise<boolean> {
  console.log();
  console.log(chalk.bold("Baseline Generation"));
  console.log();
  console.log(
    chalk.dim(
      "  Generating baselines in CI so they match the test environment exactly."
    )
  );
  console.log(
    chalk.dim("  This takes ~1-2 minutes.")
  );
  console.log();

  // Step 1: Create the temporary workflow file
  mkdirSync(".github/workflows", { recursive: true });
  const workflow = generateUpdateSnapshotsWorkflow(
    opts.nodeVersion,
    opts.installCommand,
    opts.buildCommand,
    opts.cacheKey
  );
  writeFileSync(WORKFLOW_PATH, workflow);

  // Step 2: Commit and push (the workflow must exist on the default branch to trigger)
  try {
    execSync("git add .github/workflows/update-snapshots.yml", {
      stdio: "pipe",
    });
    execSync(
      'git commit -m "Add temporary baseline generation workflow"',
      { stdio: "pipe" }
    );
    execSync("git push", { stdio: "pipe" });
  } catch (e) {
    console.log(
      `  ${chalk.red("✗")} Failed to push workflow — check your branch protection settings`
    );
    // Clean up the local file
    if (existsSync(WORKFLOW_PATH)) unlinkSync(WORKFLOW_PATH);
    runSilent("git reset HEAD~1");
    return false;
  }

  console.log(`  ${chalk.green("✓")} Pushed baseline generation workflow`);

  // Step 3: Trigger the workflow
  try {
    execSync(
      `gh workflow run "Update Snapshots" --repo ${opts.repoFullName}`,
      { stdio: "pipe" }
    );
  } catch {
    console.log(
      `  ${chalk.red("✗")} Failed to trigger workflow — try running it manually from GitHub Actions`
    );
    return false;
  }

  console.log(`  ${chalk.green("✓")} Triggered baseline generation`);

  // Step 4: Wait for the workflow to complete
  console.log(`  ⏳ Waiting for CI to generate baselines...`);

  const maxWait = 180; // 3 minutes
  const pollInterval = 10; // seconds
  let elapsed = 0;
  let completed = false;
  let success = false;

  // Wait a moment for the run to appear
  await new Promise((r) => setTimeout(r, 5000));

  while (elapsed < maxWait) {
    try {
      const status = run(
        `gh run list --repo ${opts.repoFullName} --workflow "Update Snapshots" --limit 1 --json status,conclusion --jq '.[0]'`
      );
      const parsed = JSON.parse(status);

      if (parsed.status === "completed") {
        completed = true;
        success = parsed.conclusion === "success";
        break;
      }
    } catch {
      // Run may not be visible yet
    }

    await new Promise((r) => setTimeout(r, pollInterval * 1000));
    elapsed += pollInterval;
    process.stdout.write(".");
  }

  console.log(); // newline after dots

  if (!completed) {
    console.log(
      `  ${chalk.yellow("!")} Timed out waiting for baselines. Check GitHub Actions for status.`
    );
    return false;
  }

  if (!success) {
    console.log(
      `  ${chalk.red("✗")} Baseline generation failed. Check the workflow run for errors.`
    );
    return false;
  }

  console.log(`  ${chalk.green("✓")} Baselines generated in CI`);

  // Step 5: Pull the CI-generated baselines
  try {
    execSync("git pull", { stdio: "pipe" });
    console.log(`  ${chalk.green("✓")} Pulled CI-generated baselines`);
  } catch {
    console.log(
      `  ${chalk.yellow("!")} Failed to pull — run "git pull" manually to get the new baselines`
    );
  }

  // Step 6: Remove the temporary workflow and push
  try {
    if (existsSync(WORKFLOW_PATH)) unlinkSync(WORKFLOW_PATH);
    execSync("git add .github/workflows/", { stdio: "pipe" });
    execSync('git commit -m "Remove temporary baseline generation workflow"', {
      stdio: "pipe",
    });
    execSync("git push", { stdio: "pipe" });
    console.log(`  ${chalk.green("✓")} Cleaned up temporary workflow`);
  } catch {
    console.log(
      `  ${chalk.yellow("!")} Could not remove temporary workflow — delete .github/workflows/update-snapshots.yml manually`
    );
  }

  return true;
}
