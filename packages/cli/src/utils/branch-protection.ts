// Optional branch protection setup for the merge gate.
// Adds "Triaige Visual Regression" as a required status check.

import { execSync } from "node:child_process";
import chalk from "chalk";

const CHECK_NAME = "Triaige Visual Regression";

export function setupBranchProtection(
  repoFullName: string,
  branch: string = "main"
): boolean {
  try {
    // Read existing protection to avoid overwriting other rules
    let existingContexts: string[] = [];
    let strict = true;

    try {
      const existing = execSync(
        `gh api repos/${repoFullName}/branches/${branch}/protection --jq '.required_status_checks'`,
        { stdio: "pipe" }
      ).toString();

      const parsed = JSON.parse(existing);
      existingContexts = parsed.contexts || [];
      strict = parsed.strict ?? true;
    } catch {
      // No existing protection — we'll create it fresh
    }

    // Add Triaige check if not already present
    if (existingContexts.includes(CHECK_NAME)) {
      console.log(
        `  ${chalk.green("✓")} "${CHECK_NAME}" already in required checks`
      );
      return true;
    }

    const contexts = [...existingContexts, CHECK_NAME];
    const payload = JSON.stringify({
      required_status_checks: { strict, contexts },
      enforce_admins: false,
      required_pull_request_reviews: null,
      restrictions: null,
    });

    execSync(
      `gh api repos/${repoFullName}/branches/${branch}/protection -X PUT --input -`,
      { input: payload, stdio: ["pipe", "pipe", "pipe"] }
    );

    console.log(
      `  ${chalk.green("✓")} Added "${CHECK_NAME}" as required status check on ${branch}`
    );
    return true;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : String(err);

    if (message.includes("upgrade") || message.includes("not available")) {
      console.log(
        `  ${chalk.yellow("!")} Branch protection requires a paid GitHub plan for private repos`
      );
    } else {
      console.log(
        `  ${chalk.red("✗")} Failed to set branch protection: ${message}`
      );
    }
    return false;
  }
}
