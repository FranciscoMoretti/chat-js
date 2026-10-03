/* oxlint-disable sort-imports --
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
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
/* oxlint-disable eslint/no-loop-func -- Each ordered mock iteration intentionally captures its current block-scoped response. */
/* oxlint-disable eslint/func-style -- Hoisted test helpers keep scenario setup readable and stable. */
/* oxlint-disable eslint/no-await-in-loop -- Integration steps and transaction fixtures intentionally run in order. */
/* oxlint-disable eslint/require-await -- Async mocks preserve the Promise-returning production callback contract. */
/* oxlint-disable eslint/sort-keys -- Fixture field order mirrors serialized protocol and persistence payloads. */
import { expect, test } from "vitest";
/* oxlint-enable sort-imports */

const actor = {
  authenticator: "test",
  principalId: "owner",
  principalType: "user",
};
/* oxlint-disable oxc/no-rest-spread-properties, unicorn/no-null --
 * oxc/no-rest-spread-properties (#543): session copies or separates ...actor while preserving existing object ownership; mutating source objects is not equivalent.
 * unicorn/no-null (#570): session preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
const session = {
  auth: { current: null, initiator: { ...actor, attributes: {} } },
  sessionId: "session",
  turn: { id: "turn_1", sequence: 1 },
};
/* oxlint-enable oxc/no-rest-spread-properties, unicorn/no-null */
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
/* oxlint-disable no-undefined, oxc/no-rest-spread-properties, typescript/explicit-function-return-type --
 * no-undefined (#519): fixture uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * oxc/no-rest-spread-properties (#543): fixture copies or separates ...actor while preserving existing object ownership; mutating source objects is not equivalent.
 * typescript/explicit-function-return-type (#560): Keep fixture's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 */
function fixture() {
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
}
/* oxlint-enable no-undefined, oxc/no-rest-spread-properties, typescript/explicit-function-return-type */

/* oxlint-disable oxc/no-async-await, oxc/no-rest-spread-properties, typescript/prefer-readonly-parameter-types --
 * oxc/no-async-await (#540): test("native executor receives only its exact authorized session/call/tool/input rece sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * oxc/no-rest-spread-properties (#543): test("native executor receives only its exact authorized session/call/tool/input rece copies or separates ...session while preserving existing object ownership; mutating source objects is not equivalent.
 * typescript/prefer-readonly-parameter-types (#565): test("native executor receives only its exact authorized session/call/tool/input rece accepts toolContext; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
test("native executor receives only its exact authorized session/call/tool/input receipt", async () => {
  const { ctx, state } = fixture();
  prepareToolApprovalReceipts(ctx, "session", [batch], state);
  await contextStorage.run(ctx, async () => {
    const execute = createToolExecuteWithAuth({
      execute: (_input, toolContext) => toolContext.approval,
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
/* oxlint-enable oxc/no-async-await, oxc/no-rest-spread-properties, typescript/prefer-readonly-parameter-types */

/* oxlint-disable max-statements, no-magic-numbers, no-undefined, oxc/no-rest-spread-properties --
 * max-statements (#512): test("old audit history, denied responses, and ambiguous calls cannot mint receipts") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("old audit history, denied responses, and ambiguous calls cannot mint receipts") uses 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * no-undefined (#519): test("old audit history, denied responses, and ambiguous calls cannot mint receipts") uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * oxc/no-rest-spread-properties (#543): test("old audit history, denied responses, and ambiguous calls cannot mint receipts") copies or separates ...batch; ...batch.inputs[0] while preserving existing object ownership; mutating source objects is not equivalent.
 */
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
/* oxlint-enable max-statements, no-magic-numbers, no-undefined, oxc/no-rest-spread-properties */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, no-ternary, oxc/no-async-await, oxc/no-rest-spread-properties, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/promise-function-async --
 * max-lines-per-function (#510): test.each(["owner", "stranger"])("native harness binds approval to its authorized res keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test.each(["owner", "stranger"])("native harness binds approval to its authorized res keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test.each(["owner", "stranger"])("native harness binds approval to its authorized res uses 4, 1, 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * no-ternary (#518): test.each(["owner", "stranger"])("native harness binds approval to its authorized res derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * oxc/no-async-await (#540): test.each(["owner", "stranger"])("native harness binds approval to its authorized res sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * oxc/no-rest-spread-properties (#543): test.each(["owner", "stranger"])("native harness binds approval to its authorized res copies or separates ...actor while preserving existing object ownership; mutating source objects is not equivalent.
 * typescript/explicit-function-return-type (#560): Keep test.each(["owner", "stranger"])("native harness binds approval to its authorized res's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): test.each(["owner", "stranger"])("native harness binds approval to its authorized res accepts context; { responder }: { responder: { principalId: string } }; input; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): test.each(["owner", "stranger"])("native harness binds approval to its authorized res preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
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
      execute: (_input, context): string => {
        receipts.push(context.approval);
        return "written";
      },
      scope: "mcp__write",
    });
    const tool = {
      approval: {
        request: () => "user-approval" as const,
        response: ({ responder }: { responder: { principalId: string } }) =>
          responder.principalId === "owner"
            ? { status: "allowed" as const }
            : { status: "rejected" as const, reason: "Owner only" },
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
      resolveModel: async () => model,
      tools: new Map([[tool.name, tool]]),
    });
    let result = await contextStorage.run(ctx, () =>
      step(pending, {
        attributedInputResponses: [
          {
            auth: { ...actor, attributes: {}, principalId },
            response: { optionId: "approve", requestId: "request" },
          },
        ],
      })
    );
    for (
      let iteration = 0;
      iteration < 4 && typeof result.next === "function";
      iteration += 1
    ) {
      const { next } = result;
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
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, no-ternary, oxc/no-async-await, oxc/no-rest-spread-properties, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */
