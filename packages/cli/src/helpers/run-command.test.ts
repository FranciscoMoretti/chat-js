import { expect, it } from "bun:test";

import { run } from "../../test/run-command";

it("reports command timeouts even when descendants keep the pipes open", async () => {
  // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- Await the asynchronous matcher before advancing the test; Bun matcher declarations expose a void result.
  await expect(
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
