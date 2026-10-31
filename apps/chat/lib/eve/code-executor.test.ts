import { beforeEach, expect, it, vi } from "vitest";
import { testToolContext } from "@/tests/helpers/eve-tool-context";

const mocks = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  createModuleLogger: (): { error: ReturnType<typeof vi.fn> } => ({
    error: vi.fn(),
  }),
}));
vi.mock("@/lib/eve/code-sandbox-ownership", () => ({
  eveCodeSandboxOwnership: vi.fn(),
}));
vi.mock("@/lib/sandbox/runtime", () => ({ getSandboxProvider: vi.fn() }));
vi.mock("@chat-js/sandboxes/runtime", () => ({ withSandbox: mocks.execute }));

beforeEach(() => {
  mocks.execute.mockReset();
});

it("the selected typed executor returns exactly one completed usage receipt", async () => {
  const { executeCode } = await import("@/chatjs/tools/code-execution/tool");
  mocks.execute.mockResolvedValue({ chart: "", message: "42" });
  const result = await executeCode(
    { code: "return 42", language: "javascript", title: "Answer" },
    testToolContext()
  );
  expect(result).toMatchObject({
    output: { chart: "", message: "42" },
    usage: { costUsd: 0.05 },
  });
});
it("failed cleanup or invalid output does not receive a completed execution charge", async () => {
  const { executeCode } = await import("@/chatjs/tools/code-execution/tool");
  mocks.execute.mockRejectedValueOnce(new Error("cleanup failed"));
  const input = {
    code: "source",
    language: "python",
    title: "Answer",
  } as const;
  expect(await executeCode(input, testToolContext())).toMatchObject({
    usage: { costUsd: 0 },
  });
  mocks.execute.mockResolvedValueOnce({ chart: null, message: "invalid" });
  expect(await executeCode(input, testToolContext())).toMatchObject({
    usage: { costUsd: 0 },
  });
});
