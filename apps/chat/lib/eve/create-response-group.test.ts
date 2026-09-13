import { afterEach, expect, test, vi } from "vitest";

import { CreationRejectedError } from "./create-conversation";
import {
  readResponseGroupDraft,
  requestResponseGroup,
  retainResponseGroupDraft,
} from "./create-response-group";
import {
  moveRejectedProjectCreation,
  prepareCreation,
  prepareResponseGroupCreation,
  prepareSelectedCreation,
  readCreationRequest,
} from "./pending-create";
import { resolveCreationRequest } from "./resolve-creation-request";
import type { EveResponseGroupResult } from "./response-group-contracts";

afterEach(() => vi.unstubAllGlobals());
const fixture = () => {
  const entries = new Map<string, string>();
  const storage = {
    getItem: (key: string) => entries.get(key) ?? null,
    removeItem: (key: string) => {
      entries.delete(key);
    },
    setItem: (key: string, value: string) => {
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
    candidates: operation.modelIds.map((modelId, index) =>
      index === 0
        ? {
            conversationId: crypto.randomUUID(),
            modelId,
            operationId: crypto.randomUUID(),
            sessionId: "native-first",
            state: "bound",
          }
        : { modelId, operationId: crypto.randomUUID(), state: "unresolved" }
    ),
    id: crypto.randomUUID(),
  };
  return { operation, result, storage };
};

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
  expect(fetcher.mock.calls[0][1].body).toBe(JSON.stringify(operation));
  expect(() => prepareCreation(storage, "owner", "Another request")).toThrow(
    "saved comparison"
  );
});

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
    ...result,
    candidates: result.candidates.map((candidate) => ({
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

test("storage failure cannot release an unresolved request", () => {
  const { storage, operation, result } = fixture();
  const failing = {
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

test("all rejected candidates are definitive while a mixed uncertain result keeps its request", async () => {
  const { operation, result } = fixture();
  const rejected: EveResponseGroupResult = {
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
    ...rejected,
    candidates: [
      ...rejected.candidates.slice(0, 1),
      { ...result.candidates[1], state: "unresolved" },
    ],
  };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(mixed)));
  await expect(requestResponseGroup(operation)).resolves.toEqual(mixed);
});

test("rejected secondary candidates retain the original request for their retry", () => {
  const { storage, operation, result } = fixture();
  const rejected: EveResponseGroupResult = {
    ...result,
    candidates: result.candidates.map((candidate) =>
      candidate.state === "bound"
        ? candidate
        : { ...candidate, error: "Model unavailable", state: "rejected" }
    ),
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
      ...scope,
      fork: {
        ...fork,
        beforeTurnId: "turn_4",
        checkpointId: crypto.randomUUID(),
      },
    }
  );
  expect(recovered).toEqual(operation);
  fetcher
    .mockResolvedValueOnce(Response.json({ ready: true, ...fork }))
    .mockResolvedValueOnce(Response.json(result));
  await resolveCreationRequest(storage, "owner", recovered, scope);
  expect(fetcher.mock.calls[1][0]).toEqual(fetcher.mock.calls[0][0]);
  expect(fetcher.mock.calls[1][1].body).toEqual(fetcher.mock.calls[0][1].body);
  expect(JSON.parse(fetcher.mock.calls[2][1].body)).toEqual(operation);
  expect(readCreationRequest(storage, "owner", scope)).toBeUndefined();
  expect(readResponseGroupDraft(storage, "owner", result.id)).toEqual(
    operation
  );
});

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
  const fetcher = vi
    .fn()
    .mockResolvedValue(
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
    { ...scope, fork }
  );
  const rejection = {
    checkpointRejected: true,
    reason: "source_advanced",
    ...fork,
  };
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  for (const body of [
    { ...rejection, checkpointId: crypto.randomUUID() },
    { ...rejection, beforeTurnId: "turn_2" },
    { ...rejection, conversationId: crypto.randomUUID() },
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
  expect(fetcher.mock.calls.every(([url]) => url.endsWith("/checkpoint"))).toBe(
    true
  );
  // The UI owns releasing the matching pending request; the original draft is never erased here.
  expect(readCreationRequest(storage, "owner", scope)).toEqual(operation);
});
