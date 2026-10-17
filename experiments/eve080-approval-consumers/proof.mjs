import { spawnSync } from "node:child_process";
import path from "node:path";

if (process.versions.node.split(".")[0] !== "24") {
  throw new Error("Use Node24");
}
const result = spawnSync(
  process.execPath,
  [
    path.resolve(import.meta.dirname, "../../node_modules/vitest/vitest.mjs"),
    "run",
    "--config",
    path.join(import.meta.dirname, "vitest.config.ts"),
  ],
  { cwd: path.resolve(import.meta.dirname, "../.."), stdio: "inherit" }
);
process.exitCode = result.status ?? 1;
