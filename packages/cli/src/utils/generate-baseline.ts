import type { PackageManager } from "../types";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { runCommand } from "./run-command";

/** Only create calls this after dependency installation. Never reset an app's history. */
const generateBaseline = async (
  cwd: string,
  packageManager: PackageManager
): Promise<void> => {
  const history = path.join(cwd, "lib/db/migrations");
  const entries = await readdir(history).catch((error: unknown): string[] => {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  });
  if (entries.length > 0) {
    throw new Error(
      "Cannot generate a fresh baseline over an existing migration history. Use db:generate to extend it."
    );
  }
  await runCommand(
    packageManager,
    [
      "run",
      "db:generate",
      ...(packageManager === "npm" ? ["--"] : []),
      "--name=chatjs_baseline",
    ],
    cwd
  );
  const generated = await readdir(history);
  if (!generated.some((file): boolean => file.endsWith(".sql"))) {
    throw new Error("Baseline generation produced no SQL migration.");
  }
};

export { generateBaseline };
