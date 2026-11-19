import { describe, expect, it, vi } from "vitest";
import { defineTool } from "eve/tools";
import { z } from "zod";
import { testToolContext } from "../../tests/helpers/eve-tool-context";
import { withToolAccounting } from "./tool-accounting";
import { createToolResult } from "./tool-result";

const collect = async <T>(
  result: T | Promise<T> | AsyncIterable<T>
): Promise<T[]> => {
  const output = await result;
  if (
    typeof output === "object" &&
    output !== null &&
    Symbol.asyncIterator in output
  ) {
    return await Array.fromAsync(output);
  }
  return [output];
};

const approval = () => "user-approval" as const;

describe("native tool accounting assembly", () => {
  it("executes once and preserves projections, approvals, labels and end-turn behavior", async () => {
    const execute = vi.fn(({ value }: { value: string }) => ({ text: value }));
    const native = defineTool({
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ text: z.string() }),
      description: "Example native capability",
      execute,
      approval,
      toModelOutput: (output) => ({ type: "text", value: output.text }),
      endsTurn: (output) => output.text === "done",
      label: {
        start: () => "Working",
        delta: (_input, output) => output.text,
        complete: (_input, output) => output.text,
      },
    });
    const tool = withToolAccounting(native, "none");
    const context = testToolContext();
    const receipt = createToolResult({ text: "done" }, 0);
    expect(await collect(tool.execute({ value: "done" }, context))).toEqual([
      receipt,
    ]);
    expect(execute).toHaveBeenCalledExactlyOnceWith({ value: "done" }, context);
    expect(tool.approval).toBe(approval);
    expect(await tool.toModelOutput?.(receipt)).toEqual({
      type: "text",
      value: "done",
    });
    const label = tool.label === false ? undefined : tool.label;
    expect(label?.complete?.({ value: "done" }, receipt)).toBe("done");
    expect(label?.delta?.({ value: "done" }, receipt)).toBe("done");
    expect(
      typeof tool.endsTurn === "function" && (await tool.endsTurn(receipt))
    ).toBe(true);
  });

  it("preserves a tool's disabled label", () => {
    const tool = defineTool({
      description: "Example without a label",
      inputSchema: z.object({}),
      execute: () => "done",
      label: false,
    });

    expect(withToolAccounting(tool, "none").label).toBe(false);
  });

  it("retains native failures and prevents execution after cancellation", async () => {
    const failure = new Error("upstream unavailable");
    const execute = vi.fn((): string => {
      throw failure;
    });
    const tool = withToolAccounting(
      defineTool({
        description: "Failure",
        inputSchema: z.object({}),
        execute,
      }),
      "unknown"
    );
    await expect(collect(tool.execute({}, testToolContext()))).rejects.toBe(
      failure
    );
    const controller = new AbortController();
    controller.abort();
    await expect(
      collect(
        tool.execute({}, testToolContext({ abortSignal: controller.signal }))
      )
    ).rejects.toThrow();
    expect(execute).toHaveBeenCalledTimes(1);
  });
});

it("settles one charge after streaming completes", async () => {
  const native = defineTool({
    description: "Stream",
    inputSchema: z.object({}),
    async *execute() {
      yield { searches: [], updates: [{ status: "running" }] };
      yield { searches: ["source"], updates: [{ status: "completed" }] };
    },
  });
  const tool = withToolAccounting(native, { costUsd: 0.05 });
  const outputs = await collect(tool.execute({}, testToolContext()));
  expect(outputs.map((output) => output.usage.costUsd)).toEqual([
    undefined,
    undefined,
    0.05,
  ]);
  const unknown = withToolAccounting(native, "unknown");
  const unknownOutputs = await collect(unknown.execute({}, testToolContext()));
  expect(unknownOutputs.at(-1)?.usage.costUsd).toBeUndefined();
});

it("does not settle interrupted streams and closes the native iterator", async () => {
  const controller = new AbortController();
  const closed = vi.fn();
  const native = defineTool({
    description: "Interrupted stream",
    inputSchema: z.object({}),
    async *execute() {
      try {
        yield "working";
        controller.abort();
        yield "done";
      } finally {
        closed();
      }
    },
  });
  const tool = withToolAccounting(native, { costUsd: 0.05 });
  await expect(
    collect(
      tool.execute({}, testToolContext({ abortSignal: controller.signal }))
    )
  ).rejects.toThrow();
  expect(closed).toHaveBeenCalledTimes(1);
});
