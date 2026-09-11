import { Sandbox } from "@vercel/sandbox";
import pino from "pino";
import { expect, it, vi } from "vitest";
import { executePythonInSandbox } from "./python";

const mocks = vi.hoisted(() => ({ runCommand: vi.fn() }));
vi.mock("@vercel/sandbox", () => ({
  Sandbox: { create: async () => ({ runCommand: mocks.runCommand }) },
}));

it.each([
  0, 1,
])("does not log package credentials when pip exits with %s", async (exitCode) => {
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
      stderr: async () => `Could not install ${packageUrl}`,
    })
    .mockResolvedValueOnce({
      exitCode: 0,
      stdout: async () => '{"success":true}',
      stderr: async () => "",
    })
    .mockResolvedValueOnce({ exitCode: 1 });

  await executePythonInSandbox({
    sandbox: await Sandbox.create(),
    code: `!pip install ${packageUrl}\nprint(4)`,
    log,
    requestId: "test-request",
  });

  expect(mocks.runCommand).toHaveBeenNthCalledWith(2, {
    cmd: "pip",
    args: ["install", packageUrl],
  });
  expect(info).toHaveBeenCalledWith(
    { requestId: "test-request", packageCount: 1 },
    "installing extra packages"
  );
  expect(JSON.stringify([info.mock.calls, error.mock.calls])).not.toContain(
    secret
  );
  if (exitCode !== 0) {
    expect(error).toHaveBeenCalledWith(
      { requestId: "test-request", exitCode },
      "dynamic package installation failed"
    );
  }
});
