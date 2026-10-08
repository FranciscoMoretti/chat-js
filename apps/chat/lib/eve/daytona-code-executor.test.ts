/* oxlint-disable import/no-relative-parent-imports -- The contract test exercises the canonical registry adapter without installing Daytona into the Vercel demo. */
/* oxlint-disable unicorn/no-null -- Null is a malformed output fixture checked at the executor boundary. */
import { beforeEach, expect, it, vi } from "vitest";
import { testToolContext } from "@/tests/helpers/eve-tool-context";

const mocks = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("@/lib/env", () => ({
  env: { DAYTONA_API_KEY: "test", DAYTONA_ORGANIZATION_ID: "org" },
}));
vi.mock("@/lib/logger", () => ({
  createModuleLogger: (): { error: ReturnType<typeof vi.fn> } => ({
    error: vi.fn(),
  }),
}));
vi.mock("@/lib/eve/code-sandbox-ownership", () => ({
  eveCodeSandboxOwnership: vi.fn(),
}));
vi.mock(
  "../../../../packages/registry/src/tools/daytona-code-execution/sandbox",
  () => ({
    createDaytonaProvider: (): { cleanup: Record<string, never> } => ({
      cleanup: {},
    }),
  })
);
vi.mock(
  "../../../../packages/registry/src/tools/daytona-code-execution/execution",
  () => ({ executeInDaytona: mocks.execute })
);

beforeEach(() => {
  mocks.execute.mockReset();
});

/* oxlint-disable oxc/no-async-await -- Await the mocked canonical executor import and execution result before checking its cost receipt. */
it("the selected typed executor returns exactly one completed usage receipt", async () => {
  const { executeCode } =
    await import("../../../../packages/registry/src/tools/daytona-code-execution/tool");
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Await the mocked canonical executor import and execution result before checking its cost receipt. */
it("failed cleanup or invalid output does not receive a completed execution charge", async () => {
  const { executeCode } =
    await import("../../../../packages/registry/src/tools/daytona-code-execution/tool");
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
/* oxlint-enable oxc/no-async-await */
