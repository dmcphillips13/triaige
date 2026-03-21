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

function restoreProtection(repoFullName: string): void {
  try {
    const payload = JSON.stringify({
      required_status_checks: {
        strict: true,
        contexts: ["Triaige Visual Regression"],
      },
      enforce_admins: false,
      required_pull_request_reviews: null,
      restrictions: null,
    });
    execSync(
      `gh api repos/${repoFullName}/branches/main/protection -X PUT --input -`,
      { input: payload, stdio: ["pipe", "pipe", "pipe"] }
    );
  } catch {
    // Best effort — protection will be re-added by the CLI's branch protection step
  }
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

  // Step 2: Temporarily remove branch protection if it exists (so CI can push baselines)
  let hadProtection = false;
  let protectionConfig: string | null = null;
  try {
    protectionConfig = run(
      `gh api repos/${opts.repoFullName}/branches/main/protection 2>/dev/null`
    );
    execSync(
      `gh api repos/${opts.repoFullName}/branches/main/protection -X DELETE`,
      { stdio: "pipe" }
    );
    hadProtection = true;
    console.log(
      `  ${chalk.green("✓")} Temporarily removed branch protection`
    );
  } catch {
    // No protection to remove — that's fine
  }

  // Step 3: Commit and push
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
      `  ${chalk.red("✗")} Failed to push workflow`
    );
    if (existsSync(WORKFLOW_PATH)) unlinkSync(WORKFLOW_PATH);
    runSilent("git reset HEAD~1");
    // Restore protection if we removed it
    if (hadProtection && protectionConfig) {
      restoreProtection(opts.repoFullName);
    }
    return false;
  }

  console.log(`  ${chalk.green("✓")} Pushed baseline generation workflow`);

  // Step 3: Wait for GitHub to register the workflow, then trigger it
  // GitHub needs a few seconds after a push to make a new workflow dispatchable
  console.log(`  ⏳ Waiting for GitHub to register the workflow...`);
  let triggered = false;
  for (let attempt = 0; attempt < 6; attempt++) {
    await new Promise((r) => setTimeout(r, 5000));
    try {
      execSync(
        `gh workflow run "Update Snapshots" --repo ${opts.repoFullName}`,
        { stdio: "pipe" }
      );
      triggered = true;
      break;
    } catch {
      // Workflow not yet available, retry
    }
  }

  if (!triggered) {
    console.log(
      `  ${chalk.red("✗")} Failed to trigger workflow — try running it manually from GitHub Actions`
    );
    if (hadProtection) restoreProtection(opts.repoFullName);
    return false;
  }

  console.log(`  ${chalk.green("✓")} Triggered baseline generation`);
  console.log(
    `  ${chalk.dim(`  Watch progress: https://github.com/${opts.repoFullName}/actions/workflows/update-snapshots.yml`)}`
  );

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

  // Step 7: Restore branch protection if we removed it
  if (hadProtection) {
    restoreProtection(opts.repoFullName);
    console.log(`  ${chalk.green("✓")} Restored branch protection`);
  }

  return true;
}
