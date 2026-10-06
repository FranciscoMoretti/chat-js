/* oxlint-disable typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions -- The dynamic runtime boundary supports the two pinned SDK context shapes; runtime guards verify them. */
/* oxlint-disable eslint/no-await-in-loop -- Each harness continuation depends on the previous result. */
/* oxlint-disable eslint/require-await, typescript/require-await -- Mock model and event callbacks retain the runtime Promise contract. */
/* oxlint-disable eslint/max-statements, eslint/max-lines-per-function -- The fixture keeps one private executor, its approval policies and mutable effect probe together. */
/* oxlint-disable eslint/no-magic-numbers, unicorn/no-null -- Literal protocol values and absent auth/sandbox identities are deliberate runtime fixtures. */
/* oxlint-disable import/no-nodejs-modules -- The isolated runtime fixture uses filesystem storage and native module loading. */
/* oxlint-disable typescript/no-unsafe-assignment, typescript/no-unsafe-call, typescript/no-unsafe-member-access, typescript/no-unsafe-return, typescript/no-unsafe-argument, typescript/restrict-template-expressions -- This experiment loads two exact runtime distributions by filesystem path; dynamic internal exports have no common static type contract. Runtime assertions verify the boundary. */
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Run against an isolated installation, never an accidental workspace alias.
const packageRoot = path.resolve(process.argv[2]);
const manifest = JSON.parse(
  await readFile(path.join(packageRoot, "package.json"), "utf-8")
);
const fork = manifest.name === "@chat-js/eve";
assert.equal(manifest.version, fork ? "0.61.0-chatjs.0" : "0.71.3");
const load = async (file) =>
  await import(pathToFileURL(path.join(packageRoot, "dist/src", file)).href);
const { ContextContainer, contextStorage } = await load("context/container.js");
const { SessionKey, SessionIdKey, AuthKey } = await load("context/keys.js");
const { createToolLoopHarness } = await load("harness/tool-loop.js");
const { createToolExecuteWithAuth } = await load("execution/tool-auth.js");
const { getPendingInputBatches } = await load(
  "harness/pending-input-batches.js"
);
const { createRequire } = await import("node:module");
const requireRuntime = createRequire(path.join(packageRoot, "package.json"));
const { jsonSchema, simulateReadableStream } = await import(
  pathToFileURL(requireRuntime.resolve("ai")).href
);
const { MockLanguageModelV4 } = await import(
  pathToFileURL(requireRuntime.resolve("ai/test")).href
);
const owner = {
  attributes: {},
  authenticator: "test",
  principalId: "owner",
  principalType: "user",
};
const foreign = { ...owner, principalId: "foreign" };
const input = {
  documentId: "document",
  expectedRevisionId: "revision-1",
  title: "Notes",
};
const usage = {
  inputTokens: { cacheRead: 0, cacheWrite: 0, noCache: 1, total: 1 },
  outputTokens: { reasoning: 0, text: 1, total: 1 },
};
const scratch = await mkdtemp(path.join(tmpdir(), "eve-lane-a-"));

// A bounded candidate tool, not a replacement for the production DB transaction.
// Execution stays private; only its authored definition enters the real harness.
const fixture = (stream) => {
  const cancellation = new AbortController();
  const state = {
    afterApproval: () => {
      /* Most cases do not mutate state during approval. */
    },
    callNext: false,
    cancel: () => cancellation.abort(new Error("Turn cancelled before effect")),
    effects: [],
    ownerId: "owner",
    policyResponses: [],
    revision: "revision-1",
  };
  const newContext = () => {
    const ctx = new ContextContainer();
    ctx.set(SessionKey, {
      auth: { current: owner, initiator: owner },
      sessionId: "session",
      turn: { id: "turn", sequence: 1 },
    });
    ctx.set(SessionIdKey, "session");
    ctx.set(AuthKey, owner);
    return ctx;
  };
  let ctx = newContext();
  const guard = (value, context) => {
    context.abortSignal.throwIfAborted();
    if (context.session.auth.initiator?.principalId !== state.ownerId) {
      throw new Error("Owner changed");
    }
    if (
      value.expectedRevisionId !== state.revision ||
      value.title !== input.title
    ) {
      throw new Error("Document changed");
    }
  };
  const authorize = (principal, decision, session) => {
    state.policyResponses.push({
      decision,
      principalId: principal.principalId,
    });
    if (principal.principalId !== session.initiator?.principalId) {
      return { reason: "Owner only", status: "rejected" };
    }
    state.afterApproval();
    return { status: "allowed" };
  };
  const tool = {
    approval: {
      request: (context) => {
        guard(context.toolInput, context);
        return "user-approval";
      },
      response: fork
        ? ({ responder, response, session }) =>
            authorize(responder, response.decision, session)
        : ({ response, session }) =>
            authorize(response.principal, response.decision, session),
    },
    description: "Delete the current document after owner approval",
    execute: createToolExecuteWithAuth({
      execute: (value, context) => {
        guard(value, context);
        state.effects.push(value);
        return "deleted";
      },
      scope: "deleteDocument",
    }),
    inputSchema: jsonSchema({
      properties: {
        documentId: { type: "string" },
        expectedRevisionId: { type: "string" },
        title: { type: "string" },
      },
      required: ["documentId", "expectedRevisionId", "title"],
      type: "object",
    }),
    name: "deleteDocument",
  };
  let calls = 0;
  const response = () => {
    const call = calls === 0 || state.callNext;
    calls += 1;
    state.callNext = false;
    return {
      content: call
        ? [
            {
              input: JSON.stringify(input),
              toolCallId: `call-${calls}`,
              toolName: tool.name,
              type: "tool-call",
            },
          ]
        : [{ text: "Done", type: "text" }],
      finishReason: { raw: "stop", unified: call ? "tool-calls" : "stop" },
      usage,
      warnings: [],
    };
  };
  const model = new MockLanguageModelV4({
    doGenerate: async () => response(),
    doStream: async () => {
      const result = response();
      const content = result.content.flatMap((part) =>
        part.type === "tool-call"
          ? [part]
          : [
              { id: "text", type: "text-start" },
              { delta: part.text, id: "text", type: "text-delta" },
              { id: "text", type: "text-end" },
            ]
      );
      return {
        stream: simulateReadableStream({
          chunks: [
            { type: "stream-start", warnings: [] },
            ...content,
            { finishReason: result.finishReason, type: "finish", usage },
          ],
        }),
      };
    },
  });
  const configuration = {
    abortSignal: cancellation.signal,
    capabilities: { requestInput: true },
    mode: "conversation",
    resolveModel: async () => model,
    tools: new Map([[tool.name, tool]]),
    ...(stream
      ? {
          handleEvent: async () => {
            /* Presence selects the real streaming path. */
          },
        }
      : {}),
  };
  let step = createToolLoopHarness(configuration);
  let session = {
    agent: {
      modelReference: { id: "mock" },
      system: "Delete only with permission",
      tools: [],
    },
    compaction: { recentWindowSize: 10, threshold: 100_000 },
    continuationToken: "continuation",
    history: [{ content: "Delete", kind: "user", role: "user" }],
    sessionId: "session",
  };
  const advance = async (delivery) => {
    let result = await contextStorage.run(ctx, () => step(session, delivery));
    for (let iteration = 0; typeof result.next === "function"; iteration += 1) {
      assert.ok(iteration < 12, "bounded native continuation");
      const current = result;
      result = await contextStorage.run(ctx, () =>
        current.next(current.session)
      );
    }
    ({ session } = result);
    return result;
  };
  const pending = () =>
    getPendingInputBatches(session.state).flatMap((batch) => batch.requests);
  const respond = async (
    principal,
    decision,
    requestId = pending()[0]?.requestId
  ) => {
    assert.ok(requestId, "real runtime produced the pending request");
    return await advance({
      attributedInputResponses: [
        { auth: principal, response: { optionId: decision, requestId } },
      ],
    });
  };
  const reload = async () => {
    const file = path.join(scratch, "session.json");
    await writeFile(file, JSON.stringify(session));
    session = JSON.parse(await readFile(file, "utf-8"));
    ctx = newContext();
    step = createToolLoopHarness(configuration);
  };
  const invoke = async (auth) => {
    const { invokeTool } = await load("execution/invoke-tool.js");
    return await invokeTool(
      {
        agentName: "lane-a",
        callbackBaseUrl: "http://127.0.0.1:1",
        compiledArtifactsSource: { kind: "bundled" },
        manifest: {
          bindings: { deletion: { owner: { kind: "application" } } },
          tools: [{ hasExecute: true, name: tool.name, sourceId: "deletion" }],
        },
        nodeId: "__root__",
        sandboxRegistry: { sandbox: null },
        tools: new Map([[tool.name, tool]]),
      },
      tool.name,
      input,
      { auth }
    );
  };
  return { advance, invoke, pending, reload, respond, state };
};

export { fixture, fork, foreign, input, manifest, owner, scratch };

/* oxlint-enable typescript/no-unsafe-assignment, typescript/no-unsafe-call, typescript/no-unsafe-member-access, typescript/no-unsafe-return, typescript/no-unsafe-argument, typescript/restrict-template-expressions */

/* oxlint-enable import/no-nodejs-modules */

/* oxlint-enable eslint/no-magic-numbers, unicorn/no-null */

/* oxlint-enable eslint/max-statements, eslint/max-lines-per-function */

/* oxlint-enable eslint/require-await, typescript/require-await */

/* oxlint-enable eslint/no-await-in-loop */

/* oxlint-enable typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */
