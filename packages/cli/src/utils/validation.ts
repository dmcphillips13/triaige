// Prints a summary checklist of the setup status.

import chalk from "chalk";

export interface SetupStatus {
  secretsSet: boolean;
  workflowsGenerated: boolean;
  scriptGenerated: boolean;
  playwrightConfigFound: boolean;
  jsonReporterConfigured: boolean;
  baselinesGenerated: boolean;
  branchProtectionSet: boolean;
  githubAppInstalled: boolean;
}

export function printSummary(status: SetupStatus): void {
  const ok = chalk.green("✓");
  const fail = chalk.red("✗");
  const warn = chalk.yellow("!");
  const skip = chalk.dim("–");

  console.log();
  console.log(chalk.bold("Setup Summary"));
  console.log();

  console.log(
    `  ${status.secretsSet ? ok : fail} GitHub secrets configured`
  );
  console.log(
    `  ${status.workflowsGenerated ? ok : fail} Workflow files generated`
  );
  console.log(
    `  ${status.scriptGenerated ? ok : fail} post-failures.sh created`
  );
  console.log(
    `  ${status.playwrightConfigFound ? (status.jsonReporterConfigured ? ok : warn) : skip} Playwright JSON reporter ${status.playwrightConfigFound ? (status.jsonReporterConfigured ? "configured" : "needs manual setup") : "no config found"}`
  );
  console.log(
    `  ${status.baselinesGenerated ? ok : skip} CI-generated baselines`
  );
  console.log(
    `  ${status.branchProtectionSet ? ok : skip} Branch protection (merge gate)`
  );
  console.log(
    `  ${status.githubAppInstalled ? ok : fail} Triaige can access this repo`
  );

  console.log();

  if (
    status.secretsSet &&
    status.workflowsGenerated &&
    status.scriptGenerated
  ) {
    console.log(chalk.green.bold("  Ready to go!"));
    console.log();
    console.log("  Next steps:");
    if (!status.jsonReporterConfigured && status.playwrightConfigFound) {
      console.log(
        `    1. Add the JSON reporter to your Playwright config`
      );
    }
    if (!status.baselinesGenerated) {
      console.log(
        `    ${status.jsonReporterConfigured ? "1" : "2"}. Generate baselines in CI before opening your first PR`
      );
    }
    console.log(`    → Open a PR with a visual change to trigger your first triage run`);
    console.log(
      `    → View results at ${chalk.cyan("https://triaige-dashboard.vercel.app")}`
    );
  } else {
    console.log(
      chalk.yellow("  Some steps need attention — see details above.")
    );
  }

  console.log();
}
