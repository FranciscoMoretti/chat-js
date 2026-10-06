import {
  ContextContainer,
  contextStorage,
} from "@eve-test/dist/src/context/container.js";
import { SessionKey } from "@eve-test/dist/src/context/keys.js";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  getToolApprovalReceipt,
  prepareToolApprovalReceipts,
} from "@eve-test/dist/src/context/tool-approval-receipts.js";
/* oxlint-enable sort-imports */
import { createToolExecuteWithAuth } from "@eve-test/dist/src/execution/tool-auth.js";
import { settleDirectApprovalResponse } from "@eve-test/dist/src/harness/approval-candidates.js";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { ResolvedInputBatch } from "@eve-test/dist/src/harness/input-request-resolution.js";
/* oxlint-enable sort-imports */
/* oxlint-disable eslint/no-loop-func -- Each ordered mock iteration intentionally captures its current block-scoped response. */
/* oxlint-disable eslint/func-style -- Hoisted test helpers keep scenario setup readable and stable. */
/* oxlint-disable eslint/no-await-in-loop -- Integration steps and transaction fixtures intentionally run in order. */
/* oxlint-disable eslint/require-await -- Async mocks preserve the Promise-returning production callback contract. */
/* oxlint-disable eslint/sort-keys -- Fixture field order mirrors serialized protocol and persistence payloads. */
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import { expect, test } from "vitest";
/* oxlint-enable sort-imports */

const actor = {
  authenticator: "test",
  principalId: "owner",
  principalType: "user",
};
/* oxlint-disable unicorn/no-null --
 * unicorn/no-null (#570): session preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
const session = {
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing actor own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
  auth: { current: null, initiator: { ...actor, attributes: {} } },
  sessionId: "session",
  turn: { id: "turn_1", sequence: 1 },
};
/* oxlint-enable unicorn/no-null */
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
/* oxlint-disable no-undefined, typescript/explicit-function-return-type --
 * no-undefined (#519): fixture uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * typescript/explicit-function-return-type (#560): Keep fixture's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 */
function fixture() {
  const ctx = new ContextContainer();
  ctx.set(SessionKey, session);
  const { state } = settleDirectApprovalResponse({
    state: undefined,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing actor own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    actor: { ...actor, attributes: {} },
    outcome: "allowed",
    requestId: "request",
    settledAt: 1,
  });
  return { ctx, state };
}
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-undefined, typescript/explicit-function-return-type */

/* oxlint-disable typescript/prefer-readonly-parameter-types --
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
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing session own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    ctx.set(SessionKey, { ...session, sessionId: "fork" });
    expect(
      getToolApprovalReceipt("call", "mcp__write", { text: "write" })
    ).toBeUndefined();
  });
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable max-statements, no-magic-numbers, no-undefined --
 * max-statements (#512): test("old audit history, denied responses, and ambiguous calls cannot mint receipts") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("old audit history, denied responses, and ambiguous calls cannot mint receipts") uses 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * no-undefined (#519): test("old audit history, denied responses, and ambiguous calls cannot mint receipts") uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
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
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing batch own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement. Keep the existing batch.inputs[0] own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
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
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test.each(["owner", "stranger"])'s awaited sequencing and rejected-Promise behavior. resolveModel resolves MockLanguageModelV4 to the native tool-loop harness model resolver. */
/* oxlint-enable max-statements, no-magic-numbers, no-undefined */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/promise-function-async --
 * max-lines-per-function (#510): test.each(["owner", "stranger"])("native harness binds approval to its authorized res keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test.each(["owner", "stranger"])("native harness binds approval to its authorized res keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test.each(["owner", "stranger"])("native harness binds approval to its authorized res uses 4, 1, 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
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
        response: ({ responder }: { responder: { principalId: string } }) => {
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
            // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing actor own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
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
      // oxlint-disable-next-line no-ternary -- Keep expect(receipts, JSON.stringify(result)).toEqual argume as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
      principalId === "owner"
        ? [{ requestId: "request", responder: actor }]
        : []
    );
    if (principalId !== "owner") {
      expect(model.doGenerateCalls).toHaveLength(0);
    }
  }
);
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */
