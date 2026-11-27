import { Option } from "commander";

export const projectDirectory = () =>
  new Option("-c, --cwd <cwd>", "project directory").default(process.cwd());

export const jsonOutput = () =>
  new Option("--json", "print the report as JSON").default(false);

export const dryRun = () =>
  new Option("--dry-run", "show the planned changes without writing").default(
    false
  );

export const skipConfirmation = () =>
  new Option(
    "-y, --yes",
    "skip confirmation (source protections still apply)"
  ).default(false);
