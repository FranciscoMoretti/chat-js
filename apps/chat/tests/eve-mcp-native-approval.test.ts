import { expect, test } from "vitest";

import {
  ContextContainer,
  contextStorage,
} from "../../../node_modules/eve/dist/src/context/container.js";
import { SessionKey } from "../../../node_modules/eve/dist/src/context/keys.js";
import {
  getToolApprovalReceipt,
  prepareToolApprovalReceipts,
} from "../../../node_modules/eve/dist/src/context/tool-approval-receipts.js";
import { createToolExecuteWithAuth } from "../../../node_modules/eve/dist/src/execution/tool-auth.js";
import { settleDirectApprovalResponse } from "../../../node_modules/eve/dist/src/harness/approval-candidates.js";
import type { ResolvedInputBatch } from "../../../node_modules/eve/dist/src/harness/input-request-resolution.js";

const actor = {
  principalId: "owner",
  principalType: "user",
  authenticator: "test",
};
const session = {
  sessionId: "session",
  auth: { initiator: { ...actor, attributes: {} }, current: null },
  turn: { id: "turn_1", sequence: 1 },
};
const batch: ResolvedInputBatch = {
  event: { sequence: 1, stepIndex: 0, turnId: "turn_1" },
  inputs: [
    {
      outcome: "approved",
      request: {
        kind: "tool-approval",
        requestId: "request",
        prompt: "Allow?",
        action: {
          kind: "tool-call",
          callId: "call",
          toolName: "mcp__write",
          input: { text: "write" },
        },
      },
      response: { requestId: "request", optionId: "approve" },
    },
  ],
};
function fixture() {
  const ctx = new ContextContainer();
  ctx.set(SessionKey, session);
  const state = settleDirectApprovalResponse({
    state: undefined,
    actor: { ...actor, attributes: {} },
    outcome: "allowed",
    requestId: "request",
    settledAt: 1,
  }).state;
  return { ctx, state };
}

test("native executor receives only its exact authorized session/call/tool/input receipt", async () => {
  const { ctx, state } = fixture();
  prepareToolApprovalReceipts(ctx, "session", [batch], state);
  await contextStorage.run(ctx, async () => {
    const execute = createToolExecuteWithAuth({
      scope: "mcp__write",
      execute: (_input, toolContext) => toolContext.approval,
    });
    expect(
      await execute({ text: "write" }, { toolCallId: "call", messages: [] })
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
    const { jsonSchema } =
      await import("../../../node_modules/ai/dist/index.js");
    const { MockLanguageModelV4 } = await import("ai/test");
    const { appendPendingInputBatch } =
      await import("../../../node_modules/eve/dist/src/harness/pending-input-batches.js");
    const { createToolLoopHarness } =
      await import("../../../node_modules/eve/dist/src/harness/tool-loop.js");
    const { ctx } = fixture();
    const receipts: unknown[] = [];
    const execute = createToolExecuteWithAuth({
      scope: "mcp__write",
      execute: (_input, context) => {
        receipts.push(context.approval);
        return "written";
      },
    });
    const tool = {
      name: "mcp__write",
      description: "write",
      inputSchema: jsonSchema({
        type: "object",
        properties: { text: { type: "string" } },
        required: ["text"],
      }),
      execute,
      approval: {
        request: () => "user-approval" as const,
        response: ({ responder }: { responder: { principalId: string } }) =>
          responder.principalId === "owner"
            ? { status: "allowed" as const }
            : { status: "rejected" as const, reason: "Owner only" },
      },
    };
    const pending = appendPendingInputBatch({
      session: {
        sessionId: "session",
        continuationToken: "continuation",
        history: [{ role: "user", content: "Write" }],
        compaction: { recentWindowSize: 10, threshold: 100_000 },
        agent: { system: "Test", tools: [], modelReference: { id: "mock" } },
      },
      event: batch.event,
      requests: batch.inputs.map((input) => input.request),
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
    });
    const model = new MockLanguageModelV4({
      doGenerate: {
        content: [{ type: "text", text: "Done" }],
        finishReason: { unified: "stop", raw: "stop" },
        usage: {
          inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 1, text: 1, reasoning: 0 },
        },
        warnings: [],
      },
    });
    const step = createToolLoopHarness({
      mode: "conversation",
      capabilities: { requestInput: true },
      tools: new Map([[tool.name, tool]]),
      resolveModel: async () => model,
    });
    let result = await contextStorage.run(ctx, () =>
      step(pending, {
        attributedInputResponses: [
          {
            auth: { ...actor, principalId, attributes: {} },
            response: { requestId: "request", optionId: "approve" },
          },
        ],
      })
    );
    for (
      let iteration = 0;
      iteration < 4 && typeof result.next === "function";
      iteration++
    ) {
      const next = result.next;
      result = await contextStorage.run(ctx, () => next(result.session));
    }
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
