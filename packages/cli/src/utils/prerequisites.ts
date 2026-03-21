// Checks for required CLI tools and detects the current repo context.

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import chalk from "chalk";

export interface RepoContext {
  owner: string;
  repo: string;
  fullName: string;
}

export interface PrereqResult {
  ghAvailable: boolean;
  ghUser: string | null;
  jqAvailable: boolean;
  repoContext: RepoContext | null;
  packageManager: "npm" | "yarn" | "pnpm";
}

function commandExists(cmd: string): boolean {
  try {
    execSync(`which ${cmd}`, { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function getGhUser(): string | null {
  try {
    const output = execSync("gh auth status", {
      stdio: ["pipe", "pipe", "pipe"],
      encoding: "utf-8",
    });
    // gh auth status outputs to stdout on newer versions
    const combined = (output || "").toString();
    const match = combined.match(/Logged in to github\.com account (\S+)/);
    if (match) return match[1];
  } catch (e: unknown) {
    // gh auth status may write to stderr even on success in some versions
    if (e && typeof e === "object" && "stderr" in e) {
      const stderr = String((e as { stderr: unknown }).stderr);
      const match = stderr.match(/Logged in to github\.com account (\S+)/);
      if (match) return match[1];
    }
    if (e && typeof e === "object" && "stdout" in e) {
      const stdout = String((e as { stdout: unknown }).stdout);
      const match = stdout.match(/Logged in to github\.com account (\S+)/);
      if (match) return match[1];
    }
  }
  return null;
}

function getRepoContext(): RepoContext | null {
  try {
    const remote = execSync("git remote get-url origin", { stdio: "pipe" })
      .toString()
      .trim();

    // Handle SSH (git@github.com:owner/repo.git) and HTTPS
    const match = remote.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
    if (match) {
      return {
        owner: match[1],
        repo: match[2],
        fullName: `${match[1]}/${match[2]}`,
      };
    }
    return null;
  } catch {
    return null;
  }
}

function detectPackageManager(): "npm" | "yarn" | "pnpm" {
  if (existsSync("pnpm-lock.yaml")) return "pnpm";
  if (existsSync("yarn.lock")) return "yarn";
  return "npm";
}

export function checkPrerequisites(): PrereqResult {
  const ghAvailable = commandExists("gh");
  const ghUser = ghAvailable ? getGhUser() : null;
  const jqAvailable = commandExists("jq");
  const repoContext = getRepoContext();
  const packageManager = detectPackageManager();

  return { ghAvailable, ghUser, jqAvailable, repoContext, packageManager };
}

export function printPrereqStatus(prereqs: PrereqResult): void {
  const ok = chalk.green("✓");
  const fail = chalk.red("✗");
  const warn = chalk.yellow("!");

  console.log();
  console.log(chalk.bold("Prerequisites"));
  console.log();

  if (prereqs.ghAvailable && prereqs.ghUser) {
    console.log(
      `  ${ok} GitHub CLI authenticated as ${chalk.cyan(prereqs.ghUser)}`
    );
  } else if (prereqs.ghAvailable) {
    console.log(`  ${fail} GitHub CLI installed but not authenticated`);
    console.log(`    Run: ${chalk.cyan("gh auth login")}`);
  } else {
    console.log(`  ${fail} GitHub CLI not found`);
    console.log(`    Install: ${chalk.cyan("https://cli.github.com")}`);
    console.log(`    Secrets and branch protection will need manual setup.`);
  }

  if (prereqs.jqAvailable) {
    console.log(`  ${ok} jq available`);
  } else {
    console.log(`  ${warn} jq not found — required by post-failures.sh`);
    console.log(
      `    Install: ${chalk.cyan("brew install jq")} or ${chalk.cyan("apt-get install jq")}`
    );
  }

  if (prereqs.repoContext) {
    console.log(
      `  ${ok} Repository: ${chalk.cyan(prereqs.repoContext.fullName)}`
    );
  } else {
    console.log(
      `  ${fail} Could not detect GitHub repository from git remote`
    );
  }

  console.log(`  ${ok} Package manager: ${chalk.cyan(prereqs.packageManager)}`);
  console.log();
}
