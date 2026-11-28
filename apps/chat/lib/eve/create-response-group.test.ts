import { eveResponseGroupInput } from "@/chatjs/plugins/parallel-responses/response-group-input";
import { logicalResponseSlots } from "@/chatjs/plugins/parallel-responses/logical-response-slots";
import { LogicalChat, sharedPromptMessageId } from "./logical-chat";
import { creationHandler as single } from "./single-creation";
import { afterEach, expect, test, vi } from "vitest";

import { CreationRejectedError } from "./create-conversation";
import {
  advanceWaitingResponseGroup,
  canAutomaticallyProgressResponseGroup,
  readResponseGroupDraft,
  requestResponseGroup,
  retainResponseGroupDraft,
} from "@/chatjs/plugins/parallel-responses/create-response-group";
import {
  moveRejectedContextCreation,
  prepareCreation,
  prepareSelectedCreation,
  readCreationRequest,
} from "./pending-create";
import { resolveCreationRequest } from "./resolve-creation-request";
import type { EveResponseGroupResult } from "@/chatjs/plugins/parallel-responses/response-group-contracts";

const rpcResponse = (value: EveResponseGroupResult) =>
  Response.json({ result: { data: { json: value } } });

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
  const operation = prepareSelectedCreation(
    storage,
    "owner",
    "Exact original message",
    ["model-a", "model-a", "model-b"]
  );
  if (!("modelIds" in operation)) {
    throw new Error("Expected a comparison");
  }
  const result: EveResponseGroupResult = {
    candidates: operation.modelIds.map((modelId, index) => {
      if (index === 0) {
        return {
          branchId: crypto.randomUUID(),
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
  expect(fetcher.mock.calls[0][0]).toBe("/api/trpc/parallelResponses.submit");
  expect(fetcher.mock.calls[0][1]?.body).toBe(
    JSON.stringify({ json: operation })
  );
  expect(() => prepareCreation(storage, "owner", "Another request")).toThrow(
    "Recover the saved request"
  );
});

test("partial binding moves recovery before releasing the composer and preserves a subsequent draft", async () => {
  const { storage, operation, result } = fixture();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(rpcResponse(result)));
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
      branchId: crypto.randomUUID(),
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
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(rpcResponse(rejected)));
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
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(rpcResponse(mixed)));
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
  const context = {
    key: `project:${projectId}`,
    label: "project",
  };
  const original = prepareSelectedCreation(
    storage,
    "project-owner",
    "Project message",
    ["model-a", "model-a"],
    { context },
    undefined,
    { projectId }
  );
  const moved = moveRejectedContextCreation(
    storage,
    "project-owner",
    context,
    original.operationId
  );
  expect(moved).toMatchObject({
    message: original.message,
    modelIds: ["model-a", "model-a"],
  });
  expect(moved.operationId).not.toBe(original.operationId);
  expect(moved.projectId).toBeUndefined();
  expect(
    readCreationRequest(storage, "project-owner", { context })
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
      branchId: crypto.randomUUID(),
      sessionId: `native-${candidate.operationId}`,
      state: "bound",
    })),
  };
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(rpcResponse(complete));
  vi.stubGlobal("fetch", fetcher);
  const completion = advanceWaitingResponseGroup(storage, "owner", result.id);
  expect(
    canAutomaticallyProgressResponseGroup(storage, "owner", result.id)
  ).toBe(false);
  await expect(completion).resolves.toEqual(complete);
  expect(fetcher.mock.calls[0][0]).toBe("/api/trpc/parallelResponses.submit");
  expect(fetcher.mock.calls[0][1]?.body).toBe(
    JSON.stringify({ json: operation })
  );
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

test("a saved comparison survives recovery with the plugin removed", async () => {
  const { storage, operation } = fixture();
  const fetcher = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", fetcher);
  expect(() => single.parse(operation)).toThrow("Restore the original plugins");
  await expect(single.resolve(storage, "owner", operation)).rejects.toThrow();
  expect(fetcher).not.toHaveBeenCalled();
  expect(readCreationRequest(storage, "owner")).toEqual(operation);
});

test("an edit cannot replace a pending single fork with a comparison", () => {
  const { storage } = fixture();
  const branchId = crypto.randomUUID();
  const scope = { branchId, fork: { branchId }, forkKind: "edit" } as const;
  const pending = prepareSelectedCreation(
    storage,
    "owner",
    "Edit",
    ["a"],
    scope
  );

  expect(() =>
    prepareSelectedCreation(storage, "owner", "Compare", ["a", "b"], scope)
  ).toThrow("Recover the saved conversation");
  expect(readCreationRequest(storage, "owner", scope)).toEqual(pending);
});

const groupWire =
  '{"operationId":"11111111-1111-4111-8111-111111111111","modelIds":["test/one","test/two"],"message":"hello","fork":{"branchId":"22222222-2222-4222-8222-222222222222"}}';

test("preserves persisted comparison hashes for current-conversation copies", () => {
  const parsed = eveResponseGroupInput.parse(JSON.parse(groupWire));
  const serialized = JSON.stringify(parsed);
  expect(serialized).toBe(groupWire);
});

test("comparisons reject an unavailable project installation", async () => {
  vi.resetModules();
  vi.doMock("@/integrations/plugin-catalog", () => ({
    installedPlugins: new Set(),
  }));
  try {
    const { eveResponseGroupInput: schema } =
      await import("@/chatjs/plugins/parallel-responses/response-group-input");
    expect(() =>
      schema.parse({
        ...JSON.parse(groupWire),
        fork: undefined,
        projectId: crypto.randomUUID(),
      })
    ).toThrow("Projects plugin is not installed");
  } finally {
    vi.doUnmock("@/integrations/plugin-catalog");
    vi.resetModules();
  }
});

test("only comparison groups produce model slots, and older branches can have an unknown model", () => {
  const chat = new LogicalChat("chat", "branch");
  const branch = {
    id: "branch",
    operationId: "operation",
    parentBranchId: null,
    sessionId: null,
    forkTurnId: null,
    createdAt: "2026-09-20",
    initialModelId: null,
  };
  const group = { id: "group", operationIds: [branch.operationId] };
  const promptId = sharedPromptMessageId(group.id);
  chat.setBranches([branch], [group]);
  expect(logicalResponseSlots(chat.getSnapshot(), promptId)).toBeUndefined();
  chat.setBranches(
    [branch],
    [{ ...group, details: { kind: "parallel-responses", candidates: null } }]
  );
  expect(
    logicalResponseSlots(chat.getSnapshot(), promptId)?.slots
  ).toMatchObject([{ operationId: branch.operationId, modelId: null }]);
});
