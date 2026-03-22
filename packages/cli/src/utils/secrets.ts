// Sets GitHub repo secrets via the gh CLI.
// Keys are piped via stdin — never exposed as CLI args or written to files.

import { execSync } from "node:child_process";
import chalk from "chalk";

export function setGitHubSecret(name: string, value: string): boolean {
  try {
    execSync(`gh secret set ${name}`, {
      input: value,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return true;
  } catch {
    return false;
  }
}

export function setSecrets(
  apiKey: string,
  runnerUrl: string,
  ghAvailable: boolean,
  openaiKey?: string,
): { success: boolean } {
  if (!ghAvailable) {
    console.log();
    console.log(chalk.yellow("GitHub CLI not available — set secrets manually:"));
    console.log();
    console.log("  Go to your repo → Settings → Secrets and variables → Actions");
    console.log(`  Add ${chalk.cyan("TRIAIGE_API_KEY")} with your API key`);
    console.log(`  Add ${chalk.cyan("TRIAIGE_RUNNER_URL")} with: ${runnerUrl}`);
    if (openaiKey) {
      console.log(`  Add ${chalk.cyan("OPENAI_API_KEY")} with your OpenAI key`);
    }
    console.log();
    return { success: false };
  }

  console.log();
  console.log("Setting GitHub secrets...");

  const keySet = setGitHubSecret("TRIAIGE_API_KEY", apiKey);
  if (keySet) {
    console.log(`  ${chalk.green("✓")} TRIAIGE_API_KEY`);
  } else {
    console.log(`  ${chalk.red("✗")} Failed to set TRIAIGE_API_KEY`);
    return { success: false };
  }

  const urlSet = setGitHubSecret("TRIAIGE_RUNNER_URL", runnerUrl);
  if (urlSet) {
    console.log(`  ${chalk.green("✓")} TRIAIGE_RUNNER_URL`);
  } else {
    console.log(`  ${chalk.red("✗")} Failed to set TRIAIGE_RUNNER_URL`);
    return { success: false };
  }

  if (openaiKey) {
    const openaiSet = setGitHubSecret("OPENAI_API_KEY", openaiKey);
    if (openaiSet) {
      console.log(`  ${chalk.green("✓")} OPENAI_API_KEY`);
    } else {
      console.log(`  ${chalk.red("✗")} Failed to set OPENAI_API_KEY`);
    }
  }

  return { success: true };
}
