import { afterEach, expect, test, vi } from "vitest";

import { CreationRejectedError } from "./create-conversation";
import {
  advanceWaitingResponseGroup,
  canAutomaticallyProgressResponseGroup,
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

test("lost creation replies retain the exact ordered operation across changed composer choices", async () => {
  const { storage, operation } = fixture();
  const fetcher = vi
    .fn<typeof fetch>()
    .mockRejectedValue(new Error("Lost reply"));
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
  expect(fetcher.mock.calls[0][1]?.body).toBe(JSON.stringify(operation));
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
  expect(() => {
    retainResponseGroupDraft(failing, "owner", operation, result);
  }).toThrow("Storage full");
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
    candidates: result.candidates.map((candidate) => {
      if (candidate.state === "bound") {
        return candidate;
      }
      return { ...candidate, error: "Model unavailable", state: "rejected" };
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

test("certified waiting progresses with immutable input and stops after binding", async () => {
  const { storage, operation, result } = fixture();
  const waiting: EveResponseGroupResult = {
    ...result,
    candidates: result.candidates.map((candidate) =>
      candidate.state === "bound"
        ? candidate
        : { ...candidate, state: "waiting" }
    ),
  };
  retainResponseGroupDraft(storage, "owner", operation, waiting);
  expect(
    canAutomaticallyProgressResponseGroup(storage, "owner", result.id)
  ).toBe(true);
  expect(
    canAutomaticallyProgressResponseGroup(storage, "stranger", result.id)
  ).toBe(false);
  const complete: EveResponseGroupResult = {
    ...result,
    candidates: result.candidates.map((candidate) => ({
      ...candidate,
      conversationId: crypto.randomUUID(),
      sessionId: `native-${candidate.operationId}`,
      state: "bound",
    })),
  };
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(Response.json(complete));
  vi.stubGlobal("fetch", fetcher);
  const completion = advanceWaitingResponseGroup(storage, "owner", result.id);
  expect(
    canAutomaticallyProgressResponseGroup(storage, "owner", result.id)
  ).toBe(false);
  await expect(completion).resolves.toEqual(complete);
  expect(fetcher.mock.calls[0][1]?.body).toBe(JSON.stringify(operation));
  expect(readResponseGroupDraft(storage, "owner", result.id)).toBeUndefined();
  expect(
    canAutomaticallyProgressResponseGroup(storage, "owner", result.id)
  ).toBe(false);
});

test("uncertain results and lost progress replies never automatically redispatch", async () => {
  const { storage, operation, result } = fixture();
  retainResponseGroupDraft(storage, "owner", operation, result);
  const fetcher = vi
    .fn<typeof fetch>()
    .mockRejectedValue(new Error("Lost progress reply"));
  vi.stubGlobal("fetch", fetcher);
  await expect(
    advanceWaitingResponseGroup(storage, "owner", result.id)
  ).resolves.toBeUndefined();
  expect(fetcher).not.toHaveBeenCalled();
  retainResponseGroupDraft(storage, "owner", operation, {
    ...result,
    candidates: result.candidates.map((candidate) =>
      candidate.state === "bound"
        ? candidate
        : { ...candidate, state: "waiting" }
    ),
  });
  await expect(
    advanceWaitingResponseGroup(storage, "owner", result.id)
  ).rejects.toThrow("Lost progress reply");
  expect(readResponseGroupDraft(storage, "owner", result.id)).toEqual(
    operation
  );
  expect(
    canAutomaticallyProgressResponseGroup(storage, "owner", result.id)
  ).toBe(false);
  await expect(
    advanceWaitingResponseGroup(storage, "owner", result.id)
  ).resolves.toBeUndefined();
  expect(fetcher).toHaveBeenCalledTimes(1);
});
