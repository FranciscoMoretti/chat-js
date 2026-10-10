import { expect, it } from "bun:test";

/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { run } from "../../test/run-command";
/* oxlint-enable import/no-relative-parent-imports */

const descendantsHoldPipesTimeoutMs = 250;

it("reports command timeouts even when descendants keep the pipes open", () =>
  expect(
    run(
      process.cwd(),
      [
        process.execPath,
        "-e",
        `
const { spawn } = require("node:child_process");
spawn(process.execPath, ["-e", "setTimeout(() => {}, 30000)"], { stdio: ["ignore", 1, 2] });
setTimeout(() => {}, 30000);
`,
      ],
      descendantsHoldPipesTimeoutMs
    )
  ).rejects.toThrow(`timed out after ${descendantsHoldPipesTimeoutMs}ms`));
