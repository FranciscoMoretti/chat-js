import {
  ContextContainer,
  contextStorage,
} from "@eve-test/dist/src/context/container.js";
import { SessionKey } from "@eve-test/dist/src/context/keys.js";
import {
  getToolApprovalReceipt,
  prepareToolApprovalReceipts,
} from "@eve-test/dist/src/context/tool-approval-receipts.js";
import { createToolExecuteWithAuth } from "@eve-test/dist/src/execution/tool-auth.js";
import { settleDirectApprovalResponse } from "@eve-test/dist/src/harness/approval-candidates.js";
import type { ResolvedInputBatch } from "@eve-test/dist/src/harness/input-request-resolution.js";
import type { ToolContext } from "eve/tools";

import { expect, test, vi } from "vitest";

import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

const actor = {
  authenticator: "test",
  principalId: "owner",
  principalType: "user",
};
const session = {
  auth: { current: null, initiator: { ...actor, attributes: {} } },
  sessionId: "session",
  turn: { id: "turn_1", sequence: 1 },
};
const batch: ResolvedInputBatch = {
  event: { sequence: 1, stepIndex: 0, turnId: "turn_1" },
  inputs: [
    {
      outcome: "approved",
      request: {
        action: {
          callId: "call",
          input: { text: "write" },
          kind: "tool-call",
          toolName: "mcp__write",
        },
        kind: "tool-approval",
        prompt: "Allow?",
        requestId: "request",
      },
      response: { optionId: "approve", requestId: "request" },
    },
  ],
};
const fixture = () => {
  const ctx = new ContextContainer();
  ctx.set(SessionKey, session);
  const { state } = settleDirectApprovalResponse({
    state: undefined,
    actor: { ...actor, attributes: {} },
    outcome: "allowed",
    requestId: "request",
    settledAt: 1,
  });
  return { ctx, state };
};

test("native executor receives only its exact authorized session/call/tool/input receipt", async () => {
  const { ctx, state } = fixture();
  prepareToolApprovalReceipts(ctx, "session", [batch], state);
  await contextStorage.run(ctx, async () => {
    const execute = createToolExecuteWithAuth({
      execute: (
        _input,
        toolContext: ReadonlyNativeSurface<Pick<ToolContext, "approval">>
      ) => toolContext.approval,
      scope: "mcp__write",
    });
    expect(
      await execute({ text: "write" }, { messages: [], toolCallId: "call" })
    ).toEqual({ requestId: "request", responder: actor });
    expect(
      getToolApprovalReceipt("other", "mcp__write", { text: "write" })
    ).toBeUndefined();
    expect(
      getToolApprovalReceipt("call", "other", { text: "write" })
    ).toBeUndefined();
    expect(
      getToolApprovalReceipt("call", "mcp__write", { text: "changed" })
    ).toBeUndefined();
    ctx.set(SessionKey, { ...session, sessionId: "fork" });
    expect(
      getToolApprovalReceipt("call", "mcp__write", { text: "write" })
    ).toBeUndefined();
  });
});

test("old audit history, denied responses, and ambiguous calls cannot mint receipts", () => {
  const { ctx, state } = fixture();
  contextStorage.run(ctx, () => {
    prepareToolApprovalReceipts(ctx, "session", undefined, state);
    expect(
      getToolApprovalReceipt("call", "mcp__write", { text: "write" })
    ).toBeUndefined();
    // oxlint-disable-next-line unicorn/no-useless-undefined -- Exercise absent approval state through the required state argument.
    prepareToolApprovalReceipts(ctx, "session", [batch], undefined);
    expect(
      getToolApprovalReceipt("call", "mcp__write", { text: "write" })
    ).toBeUndefined();
    prepareToolApprovalReceipts(
      ctx,
      "session",
      [{ ...batch, inputs: [{ ...batch.inputs[0], outcome: "denied" }] }],
      state
    );
    expect(
      getToolApprovalReceipt("call", "mcp__write", { text: "write" })
    ).toBeUndefined();
    prepareToolApprovalReceipts(ctx, "session", [batch, batch], state);
    expect(
      getToolApprovalReceipt("call", "mcp__write", { text: "write" })
    ).toBeUndefined();
    prepareToolApprovalReceipts(ctx, "session", [batch], state);
    expect(
      getToolApprovalReceipt("call", "mcp__write", { text: "write" })
    ).toBeDefined();
    prepareToolApprovalReceipts(ctx, "session", undefined, state);
    expect(
      getToolApprovalReceipt("call", "mcp__write", { text: "write" })
    ).toBeUndefined();
  });
});

test.each(["owner", "stranger"])(
  "native harness binds approval to its authorized responder: %s",
  async (principalId) => {
    const { jsonSchema } = await import("ai");
    const { MockLanguageModelV4 } = await import("ai/test");
    const { appendPendingInputBatch } =
      await import("@eve-test/dist/src/harness/pending-input-batches.js");
    const { createToolLoopHarness } =
      await import("@eve-test/dist/src/harness/tool-loop.js");
    const { ctx } = fixture();
    const receipts: unknown[] = [];
    const execute = createToolExecuteWithAuth({
      execute: (
        _input,
        context: ReadonlyNativeSurface<Pick<ToolContext, "approval">>
      ): string => {
        receipts.push(context.approval);
        return "written";
      },
      scope: "mcp__write",
    });
    const tool = {
      approval: {
        request: () => "user-approval" as const,
        response: ({
          responder,
        }: {
          readonly responder: { readonly principalId: string };
        }) => {
          if (responder.principalId === "owner") {
            return { status: "allowed" as const };
          }
          return { status: "rejected" as const, reason: "Owner only" };
        },
      },
      description: "write",
      execute,
      inputSchema: jsonSchema({
        type: "object",
        properties: { text: { type: "string" } },
        required: ["text"],
      }),
      name: "mcp__write",
    };
    const pending = appendPendingInputBatch({
      event: batch.event,
      requests: batch.inputs.map(
        (input: ResolvedInputBatch["inputs"][number]) => input.request
      ),
      responseAuthRequiredRequestIds: ["request"],
      responseMessages: [
        {
          role: "assistant",
          content: [
            {
              type: "tool-call",
              toolCallId: "call",
              toolName: "mcp__write",
              input: { text: "write" },
            },
            {
              type: "tool-approval-request",
              toolCallId: "call",
              approvalId: "request",
            },
          ],
        },
      ],
      session: {
        agent: { modelReference: { id: "mock" }, system: "Test", tools: [] },
        compaction: { recentWindowSize: 10, threshold: 100_000 },
        continuationToken: "continuation",
        history: [{ role: "user", kind: "user", content: "Write" }],
        sessionId: "session",
      },
    });
    const model = new MockLanguageModelV4({
      doGenerate: {
        content: [{ text: "Done", type: "text" }],
        finishReason: { raw: "stop", unified: "stop" },
        usage: {
          inputTokens: { cacheRead: 0, cacheWrite: 0, noCache: 1, total: 1 },
          outputTokens: { reasoning: 0, text: 1, total: 1 },
        },
        warnings: [],
      },
    });
    const step = createToolLoopHarness({
      capabilities: { requestInput: true },
      mode: "conversation",
      resolveModel: vi
        .fn<() => Promise<typeof model>>()
        .mockResolvedValue(model),
      tools: new Map([[tool.name, tool]]),
    });
    let result = await contextStorage.run(
      ctx,
      async () =>
        await step(pending, {
          attributedInputResponses: [
            {
              auth: { ...actor, attributes: {}, principalId },
              response: { optionId: "approve", requestId: "request" },
            },
          ],
        })
    );
    /* oxlint-disable eslint/no-await-in-loop -- Each harness continuation returns the next session and continuation consumed by the next iteration. */
    for (
      let iteration = 0;
      iteration < 4 && typeof result.next === "function";
      iteration += 1
    ) {
      const { next } = result;
      const { session: nextSession } = result;
      result = await contextStorage.run(
        ctx,
        async () => await next(nextSession)
      );
    }
    /* oxlint-enable eslint/no-await-in-loop */
    expect(receipts, JSON.stringify(result)).toEqual(
      principalId === "owner"
        ? [{ requestId: "request", responder: actor }]
        : []
    );
    if (principalId !== "owner") {
      expect(model.doGenerateCalls).toHaveLength(0);
    }
  }
);
