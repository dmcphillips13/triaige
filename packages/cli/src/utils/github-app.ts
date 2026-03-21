// Checks if the Triaige GitHub App is set up for this repo by querying the runner.
// The runner has the app's credentials and can verify installation status.

import chalk from "chalk";

const APP_INSTALL_URL = "https://github.com/apps/triaige/installations/new";

export interface AppCheckResult {
  installed: boolean;
}

export async function checkGitHubApp(
  repoFullName: string,
  runnerUrl: string,
  apiKey: string
): Promise<AppCheckResult> {
  try {
    const encoded = encodeURIComponent(repoFullName);
    const response = await fetch(`${runnerUrl}/repos/${encoded}/settings`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    // If the runner responds with 200, the repo is configured and the app can reach it
    return { installed: response.ok };
  } catch {
    return { installed: false };
  }
}

export function printAppStatus(result: AppCheckResult): void {
  const ok = chalk.green("✓");
  const fail = chalk.red("✗");

  console.log();
  console.log(chalk.bold("GitHub App"));
  console.log();

  if (result.installed) {
    console.log(`  ${ok} Triaige can access this repo`);
  } else {
    console.log(`  ${fail} Triaige GitHub App may not be installed on this repo`);
    console.log(`    Install at: ${chalk.cyan(APP_INSTALL_URL)}`);
    console.log(
      `    The app needs Contents, Pull Requests, and Checks (read/write) permissions.`
    );
  }
}
