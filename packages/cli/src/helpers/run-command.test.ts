import { it } from "bun:test";
import assert from "node:assert/strict";

import { run } from "../../test/run-command";

const descendantsHoldPipesTimeoutMs = 250;

it("reports command timeouts even when descendants keep the pipes open", async () => {
  await assert.rejects(
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
    ),
    new RegExp(`timed out after ${descendantsHoldPipesTimeoutMs}ms`, "u")
  );
});
