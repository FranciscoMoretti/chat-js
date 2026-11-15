import { expect, it, vi } from "vitest";
import { testToolContext } from "@/tests/helpers/eve-tool-context";
import type { SandboxSession } from "eve/sandbox";

vi.mock("@/lib/logger", () => ({
  createModuleLogger: () => ({ error: vi.fn(), info: vi.fn() }),
}));

const unexpected = () => {
  throw new Error("Unexpected sandbox operation");
};

it("uses the native session sandbox and keeps one usage receipt", async () => {
  const { executeCode } = await import("@/chatjs/tools/code-execution/tool");
  const run = vi.fn<SandboxSession["run"]>().mockResolvedValue({
    stdout: '42\n__EXECUTION_STATUS__:{"success":true}',
    stderr: "",
    exitCode: 0,
  });
  const sandbox: SandboxSession = {
    run,
    spawn: unexpected,
    readFile: unexpected,
    readBinaryFile: unexpected,
    readTextFile: unexpected,
    writeFile: unexpected,
    writeBinaryFile: unexpected,
    writeTextFile: unexpected,
    writeFiles: unexpected,
    resolvePath: unexpected,
    removePath: unexpected,
  };
  const getSandbox = vi.fn().mockResolvedValue(sandbox);
  const result = await executeCode(
    { code: "return 42", language: "javascript", title: "Answer" },
    { ...testToolContext(), getSandbox }
  );
  expect(getSandbox).toHaveBeenCalledTimes(1);
  expect(run.mock.calls[0]?.[0].command).toContain("'node'");
  expect(run.mock.calls[0]?.[0].signal).toBeInstanceOf(AbortSignal);
  expect(result).toMatchObject({
    output: { chart: "", message: "42" },
    usage: { costUsd: 0.05 },
  });
});

it("a native sandbox failure is not charged as completed execution", async () => {
  const { executeCode } = await import("@/chatjs/tools/code-execution/tool");
  const getSandbox = vi
    .fn()
    .mockRejectedValue(new Error("native sandbox unavailable"));
  const result = await executeCode(
    { code: "return 42", language: "javascript", title: "Answer" },
    { ...testToolContext(), getSandbox }
  );
  expect(result).toMatchObject({ usage: { costUsd: 0 } });
});
