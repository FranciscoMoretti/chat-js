import { afterEach, expect, test, vi } from "vitest";

import { CreationRejectedError } from "./create-conversation";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  readResponseGroupDraft,
  requestResponseGroup,
  retainResponseGroupDraft,
} from "./create-response-group";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import {
  moveRejectedProjectCreation,
  prepareCreation,
  prepareResponseGroupCreation,
  prepareSelectedCreation,
  readCreationRequest,
} from "./pending-create";
/* oxlint-enable sort-imports */
import { resolveCreationRequest } from "./resolve-creation-request";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { EveResponseGroupResult } from "./response-group-contracts";
/* oxlint-enable sort-imports */

afterEach(() => vi.unstubAllGlobals());
/* oxlint-disable no-magic-numbers, typescript/explicit-function-return-type, unicorn/no-null --
 * no-magic-numbers (#517): fixture uses 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/explicit-function-return-type (#560): Keep fixture's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 * unicorn/no-null (#570): fixture preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
const fixture = () => {
  const entries = new Map<string, string>();
  const storage = {
    getItem: (key: string) => entries.get(key) ?? null,
    removeItem: (key: string): void => {
      entries.delete(key);
    },
    setItem: (key: string, value: string): void => {
      entries.set(key, value);
    },
  };
  const operation = prepareResponseGroupCreation(
    storage,
    "owner",
    "Exact original message",
    ["model-a", "model-a", "model-b"]
  );
  const result: EveResponseGroupResult = {
    candidates: operation.modelIds.map((modelId, index) => {
      if (index === 0) {
        return {
          conversationId: crypto.randomUUID(),
          modelId,
          operationId: crypto.randomUUID(),
          sessionId: "native-first",
          state: "bound",
        };
      }
      return { modelId, operationId: crypto.randomUUID(), state: "unresolved" };
    }),
    id: crypto.randomUUID(),
  };
  return { operation, result, storage };
};
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers, typescript/explicit-function-return-type, unicorn/no-null */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): test("lost creation replies retain the exact ordered operation across changed compose uses 0, 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
test("lost creation replies retain the exact ordered operation across changed composer choices", async () => {
  const { storage, operation } = fixture();
  const fetcher = vi.fn().mockRejectedValue(new Error("Lost reply"));
  vi.stubGlobal("fetch", fetcher);
  await expect(
    resolveCreationRequest(storage, "owner", operation)
  ).rejects.toThrow("Lost reply");
  expect(
    prepareSelectedCreation(storage, "owner", "Changed draft", [
      "different-model",
    ])
  ).toEqual(operation);
  expect(readCreationRequest(storage, "owner")).toEqual(operation);
  // oxlint-disable-next-line typescript/no-unsafe-member-access -- #597: This create-response-group fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
  expect(fetcher.mock.calls[0][1].body).toBe(JSON.stringify(operation));
  expect(() => prepareCreation(storage, "owner", "Another request")).toThrow(
    "saved comparison"
  );
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */

/* oxlint-disable max-statements --
 * max-statements (#512): test("partial binding moves recovery before releasing the composer and preserves a su keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
test("partial binding moves recovery before releasing the composer and preserves a subsequent draft", async () => {
  const { storage, operation, result } = fixture();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(result)));
  await resolveCreationRequest(storage, "owner", operation);
  expect(readCreationRequest(storage, "owner")).toBeUndefined();
  expect(readResponseGroupDraft(storage, "owner", result.id)).toEqual(
    operation
  );
  expect(
    readResponseGroupDraft(storage, "stranger", result.id)
  ).toBeUndefined();
  const next = prepareCreation(storage, "owner", "New unrelated draft");
  const complete: EveResponseGroupResult = {
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing result own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    ...result,
    candidates: result.candidates.map((candidate) => ({
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing candidate own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      ...candidate,
      conversationId: crypto.randomUUID(),
      sessionId: `native-${candidate.operationId}`,
      state: "bound",
    })),
  };
  retainResponseGroupDraft(storage, "owner", operation, complete);
  expect(readResponseGroupDraft(storage, "owner", result.id)).toBeUndefined();
  expect(readCreationRequest(storage, "owner")).toEqual(next);
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-statements */

/* oxlint-disable typescript/explicit-function-return-type --
 * typescript/explicit-function-return-type (#560): Keep test("storage failure cannot release an unresolved request")'s return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 */
test("storage failure cannot release an unresolved request", () => {
  const { storage, operation, result } = fixture();
  const failing = {
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing storage own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    ...storage,
    setItem: () => {
      throw new Error("Storage full");
    },
  };
  expect(() =>
    retainResponseGroupDraft(failing, "owner", operation, result)
  ).toThrow("Storage full");
  expect(readCreationRequest(storage, "owner")).toEqual(operation);
});
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): test("all rejected candidates are definitive while a mixed uncertain result keeps its uses 0, 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
test("all rejected candidates are definitive while a mixed uncertain result keeps its request", async () => {
  const { operation, result } = fixture();
  const rejected: EveResponseGroupResult = {
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing result own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    ...result,
    candidates: result.candidates.map(({ operationId, modelId }) => ({
      error: "Source unavailable",
      modelId,
      operationId,
      state: "rejected",
    })),
  };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(rejected)));
  await expect(requestResponseGroup(operation)).rejects.toBeInstanceOf(
    CreationRejectedError
  );
  const mixed: EveResponseGroupResult = {
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing rejected own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    ...rejected,
    candidates: [
      ...rejected.candidates.slice(0, 1),
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing result.candidates[1] own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      { ...result.candidates[1], state: "unresolved" },
    ],
  };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(mixed)));
  await expect(requestResponseGroup(operation)).resolves.toEqual(mixed);
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable no-magic-numbers */

test("rejected secondary candidates retain the original request for their retry", () => {
  const { storage, operation, result } = fixture();
  const rejected: EveResponseGroupResult = {
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing result own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    ...result,
    candidates: result.candidates.map((candidate) => {
      if (candidate.state === "bound") {
        return candidate;
      }
      return (
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing candidate own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
        { ...candidate, error: "Model unavailable", state: "rejected" }
      );
    }),
  };
  retainResponseGroupDraft(storage, "owner", operation, rejected);
  expect(readResponseGroupDraft(storage, "owner", result.id)).toEqual(
    operation
  );
});

test("moving a definitively rejected project comparison preserves all repeated models", () => {
  const { storage } = fixture();
  const projectId = crypto.randomUUID();
  const original = prepareResponseGroupCreation(
    storage,
    "project-owner",
    "Project message",
    ["model-a", "model-a"],
    { projectId }
  );
  const moved = moveRejectedProjectCreation(
    storage,
    "project-owner",
    projectId,
    original.operationId
  );
  expect(moved).toMatchObject({
    message: original.message,
    modelIds: original.modelIds,
  });
  expect(moved.operationId).not.toBe(original.operationId);
  expect(moved.projectId).toBeUndefined();
  expect(
    readCreationRequest(storage, "project-owner", { projectId })
  ).toBeUndefined();
});

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers --
 * max-lines-per-function (#510): test("follow-up retries recover the saved checkpoint before dispatch") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("follow-up retries recover the saved checkpoint before dispatch") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("follow-up retries recover the saved checkpoint before dispatch") uses 1, 0, 2 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
test("follow-up retries recover the saved checkpoint before dispatch", async () => {
  const { storage, result } = fixture();
  const conversationId = crypto.randomUUID();
  const scope = { conversationId };
  const fork = {
    beforeTurnId: "turn_3",
    checkpointId: crypto.randomUUID(),
    conversationId,
  };
  const operation = prepareResponseGroupCreation(
    storage,
    "owner",
    "Follow up",
    ["model-a", "model-b"],
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing scope own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    { ...scope, fork }
  );
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(new Response("Lost capture reply", { status: 409 }));
  vi.stubGlobal("fetch", fetcher);
  await expect(
    resolveCreationRequest(storage, "owner", operation, scope)
  ).rejects.toThrow("saved conversation state is unconfirmed");
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(readCreationRequest(storage, "owner", scope)).toEqual(operation);
  expect(() =>
    prepareCreation(storage, "owner", "Edit instead", "model-a", scope)
  ).toThrow("saved comparison");
  const recovered = prepareResponseGroupCreation(
    storage,
    "owner",
    "Changed draft",
    ["model-b", "model-b"],
    {
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing scope own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      ...scope,
      fork: {
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing fork own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
        ...fork,
        beforeTurnId: "turn_4",
        checkpointId: crypto.randomUUID(),
      },
    }
  );
  expect(recovered).toEqual(operation);
  fetcher
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing fork own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    .mockResolvedValueOnce(Response.json({ ready: true, ...fork }))
    .mockResolvedValueOnce(Response.json(result));
  await resolveCreationRequest(storage, "owner", recovered, scope);
  expect(fetcher.mock.calls[1][0]).toEqual(fetcher.mock.calls[0][0]);
  // oxlint-disable-next-line typescript/no-unsafe-member-access -- #597: This create-response-group fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
  expect(fetcher.mock.calls[1][1].body).toEqual(fetcher.mock.calls[0][1].body);
  // oxlint-disable-next-line typescript/no-unsafe-argument, typescript/no-unsafe-member-access -- #594: This create-response-group fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration. #597: This create-response-group fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
  expect(JSON.parse(fetcher.mock.calls[2][1].body)).toEqual(operation);
  expect(readCreationRequest(storage, "owner", scope)).toBeUndefined();
  expect(readResponseGroupDraft(storage, "owner", result.id)).toEqual(
    operation
  );
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): test("a checkpoint receipt for different history cannot dispatch a comparison") uses 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
test("a checkpoint receipt for different history cannot dispatch a comparison", async () => {
  const { storage } = fixture();
  const conversationId = crypto.randomUUID();
  const fork = {
    beforeTurnId: "turn_1",
    checkpointId: crypto.randomUUID(),
    conversationId,
  };
  const operation = prepareResponseGroupCreation(
    storage,
    "owner",
    "Follow up",
    ["a", "b"],
    { conversationId, fork }
  );
  const fetcher = vi.fn().mockResolvedValue(
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing fork own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    Response.json({ ready: true, ...fork, checkpointId: crypto.randomUUID() })
  );
  vi.stubGlobal("fetch", fetcher);
  await expect(
    resolveCreationRequest(storage, "owner", operation, { conversationId })
  ).rejects.toThrow();
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(readCreationRequest(storage, "owner", { conversationId })).toEqual(
    operation
  );
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */

/* oxlint-disable max-statements, typescript/strict-boolean-expressions --
 * max-statements (#512): test("only an exact durable checkpoint rejection releases a comparison for editing") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * typescript/strict-boolean-expressions (#610): test("only an exact durable checkpoint rejection releases a comparison for editing") intentionally keeps the existing falsy-value behavior of fetcher.mock.calls.every(([url]) => url.endsWith("/checkpoint")); distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
test("only an exact durable checkpoint rejection releases a comparison for editing", async () => {
  const { storage } = fixture();
  const conversationId = crypto.randomUUID();
  const fork = {
    beforeTurnId: "turn_1",
    checkpointId: crypto.randomUUID(),
    conversationId,
  };
  const scope = { conversationId };
  const operation = prepareResponseGroupCreation(
    storage,
    "owner",
    "Keep this draft",
    ["a", "b"],
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing scope own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    { ...scope, fork }
  );
  const rejection = {
    checkpointRejected: true,
    reason: "source_advanced",
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing fork own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    ...fork,
  };
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  for (const body of [
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing rejection own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    { ...rejection, checkpointId: crypto.randomUUID() },
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing rejection own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    { ...rejection, beforeTurnId: "turn_2" },
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing rejection own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    { ...rejection, conversationId: crypto.randomUUID() },
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing rejection own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    { ...rejection, reason: "unknown" },
  ]) {
    fetcher.mockResolvedValueOnce(Response.json(body, { status: 409 }));
    // oxlint-disable-next-line eslint/no-await-in-loop -- Each case completes before the shared fixture or mock state is reused.
    await expect(
      resolveCreationRequest(storage, "owner", operation, scope)
    ).rejects.not.toBeInstanceOf(CreationRejectedError);
    expect(readCreationRequest(storage, "owner", scope)).toEqual(operation);
  }
  fetcher.mockResolvedValueOnce(Response.json(rejection, { status: 409 }));
  await expect(
    resolveCreationRequest(storage, "owner", operation, scope)
  ).rejects.toBeInstanceOf(CreationRejectedError);

  expect(
    fetcher.mock.calls.every(
      ([url]: Readonly<(typeof fetcher.mock.calls)[number]>) =>
        /* oxlint-disable typescript/no-unsafe-call, typescript/no-unsafe-member-access -- #596: This create-response-group fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration. #597: This create-response-group fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration. */
        url.endsWith("/checkpoint")
      /* oxlint-enable typescript/no-unsafe-call, typescript/no-unsafe-member-access */
    )
  ).toBe(true);
  // The UI owns releasing the matching pending request; the original draft is never erased here.
  expect(readCreationRequest(storage, "owner", scope)).toEqual(operation);
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-statements, typescript/strict-boolean-expressions */

/* oxlint-disable max-lines -- #509: This create-response-group.test.ts module keeps its existing fixture/scenario boundaries; splitting it requires an ownership design. EOF-scoped exception applies only to this file-level line metric. */
