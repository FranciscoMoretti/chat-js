import { Sandbox } from "@vercel/sandbox";
import pino from "pino";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { expect, it, vi } from "vitest";
/* oxlint-enable sort-imports */

import { executePythonInSandbox } from "@/tools/chatjs/_shared/code-execution/python";

const mocks = vi.hoisted(() => ({ runCommand: vi.fn() }));
/* oxlint-disable typescript/explicit-function-return-type --
 * typescript/explicit-function-return-type (#560): Keep vi.mock("@vercel/sandbox")'s return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 */
vi.mock("@vercel/sandbox", () => ({
  Sandbox: { create: () => ({ runCommand: mocks.runCommand }) },
}));
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it.each([0, 1])'s awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable max-statements, no-magic-numbers --
 * max-statements (#512): it.each([0, 1])("does not log package credentials when pip exits with %s") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): it.each([0, 1])("does not log package credentials when pip exits with %s") uses 0, 1, 2 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
it.each([0, 1])(
  "does not log package credentials when pip exits with %s",
  async (exitCode) => {
    const secret = "fake-private-package-token";
    const packageUrl = `https://user:${secret}@packages.example.com/private.whl`;
    const log = pino({ level: "silent" });
    const info = vi.spyOn(log, "info");
    const error = vi.spyOn(log, "error");
    mocks.runCommand.mockReset();
    mocks.runCommand
      .mockResolvedValueOnce({ exitCode: 0 })
      .mockResolvedValueOnce({
        exitCode,
        stderr: (): string => `Could not install ${packageUrl}`,
      })
      .mockResolvedValueOnce({
        exitCode: 0,
        stderr: (): string => "",
        stdout: (): string => '{"success":true}',
      })
      .mockResolvedValueOnce({ exitCode: 1 });

    await executePythonInSandbox({
      code: `!pip install ${packageUrl}\nprint(4)`,
      log,
      requestId: "test-request",
      sandbox: await Sandbox.create(),
    });

    expect(mocks.runCommand).toHaveBeenNthCalledWith(2, {
      args: ["install", packageUrl],
      cmd: "pip",
    });
    expect(info).toHaveBeenCalledWith(
      { packageCount: 1, requestId: "test-request" },
      "installing extra packages"
    );
    expect(JSON.stringify([info.mock.calls, error.mock.calls])).not.toContain(
      secret
    );
    if (exitCode !== 0) {
      expect(error).toHaveBeenCalledWith(
        { exitCode, requestId: "test-request" },
        "dynamic package installation failed"
      );
    }
  }
);
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-statements, no-magic-numbers */
