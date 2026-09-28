import type { ToolContext } from "eve/tools";
import { beforeEach, expect, test, vi } from "vitest";

import { testToolContext } from "../../tests/helpers/eve-tool-context";
import { invokeInstalledTool } from "./invoke-installed-tool";

const mocks = await vi.hoisted(async () => {
  const { defineTool, toolOutput } = await import("eve/tools");
  const { z } = await import("zod");
  const { executeWithResearchProgress } = await import("./research-progress");
  const settings = { enabled: true, protected: false, rootOnly: false };
  const execute = vi.fn();
  const search = defineTool({
    get approval() {
      return settings.protected ? () => "user-approval" as const : undefined;
    },
    get availableInSubagents() {
      return !settings.rootOnly;
    },
    description: "Search fixture",
    execute: (input, context) =>
      executeWithResearchProgress(context, ({ usage, dataStream }) => {
        execute(input, context);
        for (const status of ["running", "completed"] as const) {
          dataStream.write({
            data: {
              queries: [input.query],
              status,
              title: "Search",
              toolCallId: context.callId,
              type: "web",
            },
            id: "query",
            type: "data-researchUpdate",
          });
        }
        usage.addCostUsd(0.05);
        return Promise.resolve({ answer: input.query });
      }),
    inputSchema: z.object({
      query: z.string().transform((value) => value.trim()),
    }),
    toModelOutput: () => toolOutput.text("Projected search answer"),
  });
  return { execute, search, settings };
});
vi.mock("../../tools/chatjs/tools", () => ({
  tools: { webSearch: mocks.search },
}));
vi.mock("./turn-tools", () => ({
  eveInstalledToolEnabled: () => mocks.settings.enabled,
  eveToolAllowed: () => mocks.settings.enabled,
}));
beforeEach(() => {
  vi.resetAllMocks();
  mocks.settings.enabled = true;
  mocks.settings.protected = false;
  mocks.settings.rootOnly = false;
  delete mocks.search.outputSchema;
});

test("nested invocation validates and transforms the installed schema", async () => {
  await Array.fromAsync(
    invokeInstalledTool(
      "webSearch",
      { query: "  evidence  " },
      testToolContext()
    )
  );
  expect(mocks.execute).toHaveBeenCalledWith(
    { query: "evidence" },
    expect.objectContaining({ callId: "test", toolName: "test" })
  );
  await expect(
    Array.fromAsync(
      invokeInstalledTool("webSearch", { query: 42 }, testToolContext())
    )
  ).rejects.toThrow("Invalid tool input");
  expect(mocks.execute).toHaveBeenCalledOnce();
});

test("nested invocation never bypasses disabled features or native approval policies", async () => {
  mocks.settings.enabled = false;
  await expect(
    Array.fromAsync(
      invokeInstalledTool("webSearch", { query: "x" }, testToolContext())
    )
  ).rejects.toThrow("unavailable");
  mocks.settings.enabled = true;
  mocks.settings.protected = true;
  await expect(
    Array.fromAsync(
      invokeInstalledTool("webSearch", { query: "x" }, testToolContext())
    )
  ).rejects.toThrow("approval policies");
  expect(mocks.execute).not.toHaveBeenCalled();
});

test("composition rejects policies requiring independent EVE dispatch", async () => {
  mocks.settings.rootOnly = true;
  await expect(
    Array.fromAsync(
      invokeInstalledTool("webSearch", { query: "x" }, testToolContext())
    )
  ).rejects.toThrow("directly through EVE");
  mocks.settings.rootOnly = false;
  mocks.search.outputSchema = { type: "object" };
  await expect(
    Array.fromAsync(
      invokeInstalledTool("webSearch", { query: "x" }, testToolContext())
    )
  ).rejects.toThrow("directly through EVE");
  expect(mocks.execute).not.toHaveBeenCalled();
});

test.each(["getToken", "requireAuth"] as const)(
  "composition cannot use the parent's %s authorization scope",
  async (accessor) => {
    const auth = vi.fn();
    mocks.execute.mockImplementation((_input: unknown, context: ToolContext) =>
      context[accessor]({ getToken: auth })
    );
    await expect(
      Array.fromAsync(
        invokeInstalledTool(
          "webSearch",
          { query: "x" },
          testToolContext({
            getToken: auth,
            requireAuth: () => {
              throw new Error("Parent auth called");
            },
          })
        )
      )
    ).rejects.toThrow("direct EVE invocation");
    expect(auth).not.toHaveBeenCalled();
  }
);
