import { beforeEach, expect, test, vi } from "vitest";

import type { createEvePlatformResult } from "./platform-result";
import { executeEvePlatformTool } from "./platform-tools";

const mocks = vi.hoisted(() => ({ execute: vi.fn() }));
const settings = vi.hoisted(() => ({ enabled: true }));

vi.mock("../env", () => ({ env: {} }));
vi.mock("../config", () => ({
  config: {
    ai: {
      tools: {
        codeExecution: { enabled: false },
        image: { enabled: false },
        video: { enabled: false },
        webSearch: settings,
      },
    },
  },
}));
vi.mock("../ai/installed-tools", async () => {
  const [{ tool }, { z }] = await Promise.all([import("ai"), import("zod")]);
  return {
    installedTools: {
      webSearch: tool({
        description: "Test installed search",
        execute: async (input, { abortSignal, context, toolCallId }) => {
          const services = context as {
            costAccumulator?: {
              addAPICost: (name: string, costCents: number) => void;
            };
            dataStream?: {
              write: (part: {
                data: {
                  message: string;
                  queries: string[];
                  status: "completed" | "running";
                  title: string;
                  toolCallId: string;
                  type: "web";
                };
                id: string;
                type: "data-researchUpdate";
              }) => void;
            };
          };
          services.dataStream?.write({
            data: {
              message: input.query,
              queries: [input.query],
              status: "running",
              title: "Searching",
              toolCallId,
              type: "web",
            },
            id: toolCallId,
            type: "data-researchUpdate",
          });
          const result = await mocks.execute({ abortSignal, input });
          services.costAccumulator?.addAPICost("webSearch", 5);
          services.dataStream?.write({
            data: {
              message: input.query,
              queries: [input.query],
              status: "completed",
              title: "Search complete",
              toolCallId,
              type: "web",
            },
            id: toolCallId,
            type: "data-researchUpdate",
          });
          return result;
        },
        inputSchema: z.object({ query: z.string() }),
      }),
    },
  };
});
vi.mock("./generated-files", () => ({
  eveGeneratedFileUploader: () => vi.fn(),
}));
vi.mock("./code-sandbox-ownership", () => ({
  eveCodeSandboxOwnership: () => {
    throw new Error("Unexpected code sandbox in this tool test");
  },
}));

const context = {
  abortSignal: new AbortController().signal,
  callId: "search-test",
};
const input = { query: "example" };

beforeEach(() => {
  settings.enabled = true;
  mocks.execute.mockReset();
});

test("executes the installed tool with native progress and durable cost", async () => {
  mocks.execute.mockResolvedValue({ results: [{ title: "Example" }] });
  const results: ReturnType<typeof createEvePlatformResult>[] = [];
  for await (const result of executeEvePlatformTool(
    "webSearch",
    input,
    context,
    []
  )) {
    results.push(result);
  }

  expect(mocks.execute).toHaveBeenCalledWith({
    abortSignal: expect.any(AbortSignal),
    input,
  });
  expect(results.at(-1)).toMatchObject({
    output: { results: [{ title: "Example" }] },
    updates: [{ status: "completed", type: "web" }],
    usage: { costUsd: 0.05 },
  });
});

test("disabled search cannot execute even if a prior step advertised it", async () => {
  settings.enabled = false;
  await expect(
    executeEvePlatformTool("webSearch", input, context, []).next()
  ).rejects.toThrow("unavailable");
  expect(mocks.execute).not.toHaveBeenCalled();
});

test("closing the native iterator aborts installed tool execution", async () => {
  const aborted = Promise.withResolvers<undefined>();
  mocks.execute.mockImplementation(
    ({ abortSignal }: { abortSignal: AbortSignal }) => {
      const pending = Promise.withResolvers<never>();
      abortSignal.addEventListener(
        "abort",
        () => {
          // eslint-disable-next-line unicorn/no-useless-undefined -- PromiseWithResolvers requires its void argument.
          aborted.resolve(undefined);
          pending.reject(abortSignal.reason);
        },
        { once: true }
      );
      return pending.promise;
    }
  );
  const iterator = executeEvePlatformTool("webSearch", input, context, []);
  await iterator.next();
  await iterator.return();
  await aborted.promise;
  expect(mocks.execute.mock.calls[0][0].abortSignal.aborted).toBe(true);
});
