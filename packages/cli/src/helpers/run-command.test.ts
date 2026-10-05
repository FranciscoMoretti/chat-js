import { expect, it } from "bun:test";

/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { run } from "../../test/run-command";
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
it("reports command timeouts even when descendants keep the pipes open", () => {
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
      250
    )
  ).rejects.toThrow("timed out after 250ms");
});
/* oxlint-enable eslint/no-magic-numbers */
