import type { EveMessage } from "eve/client";
import React from "react";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { act, create } from "react-test-renderer";
/* oxlint-enable sort-imports */
import { afterEach, describe, expect, it, vi } from "vitest";

import { CreationRejectedError } from "@/lib/eve/create-conversation";
import { eveToolMetadata } from "@/lib/eve/message-tool-selection";

import { useEveFork } from "./use-eve-fork";

const mocks = vi.hoisted(() => ({
  openRuntime: vi.fn(),
  resolveCreationRequest: vi.fn(),
  restoreAttachments: vi.fn(),
}));
/* oxlint-disable typescript/explicit-function-return-type, unicorn/no-null -- use-eve-fork.test route: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

vi.mock("@tanstack/react-query", () => ({
  useMutation: () => ({ mutateAsync: mocks.restoreAttachments }),
  useQuery: () => ({
    data: {
      branches: [
        {
          forkTurnId: null,
          id: "11111111-1111-4111-8111-111111111111",
          parentConversationId: null,
        },
      ],
    },
  }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
/* oxlint-enable typescript/explicit-function-return-type, unicorn/no-null */

/* oxlint-disable typescript/explicit-function-return-type -- use-eve-fork.test route: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result. */

vi.mock("./eve-logical-context", () => ({
  useEveRuntime: () => mocks.openRuntime,
}));
/* oxlint-enable typescript/explicit-function-return-type */

vi.mock("@/lib/eve/resolve-creation-request", () => ({
  resolveCreationRequest: mocks.resolveCreationRequest,
}));
/* oxlint-disable typescript/explicit-function-return-type -- use-eve-fork.test route: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result. */

vi.mock("@/features/installed-uploads", () => ({
  attachmentUploads: {
    controls: [],
    useUploads: () => ({
      uploadQueue: [],
    }),
  },
}));
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable typescript/explicit-function-return-type -- use-eve-fork.test route: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result. */

vi.mock("@/providers/default-model-provider", () => ({
  useDefaultModel: () => "openai/gpt-4.1",
}));
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable typescript/explicit-function-return-type -- use-eve-fork.test route: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result. */

vi.mock("@/trpc/react", () => ({
  useTRPC: () => ({
    eve: {
      branches: {
        pathKey: () => ["eve", "branches"],
        queryOptions: () => ({}),
      },
      list: {
        pathKey: () => ["eve", "list"],
      },
      restoreAttachments: { mutationOptions: () => ({}) },
    },
  }),
}));
/* oxlint-enable typescript/explicit-function-return-type */

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const conversationId = "11111111-1111-4111-8111-111111111111";
const ownerId = "test-owner";
/* oxlint-disable typescript/explicit-function-return-type, unicorn/no-null -- storage: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

const storage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => {
      values.delete(key);
    },
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
};
/* oxlint-enable typescript/explicit-function-return-type, unicorn/no-null */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- userMessage: typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including parts: EveMessage["parts"] = []). */

const userMessage = (parts: EveMessage["parts"] = []): EveMessage => ({
  id: "seed_message_0",
  metadata: { custom: eveToolMetadata("webSearch") },
  parts: [{ text: "Find the answer", type: "text" }, ...parts],
  role: "user" as const,
});
/* oxlint-enable typescript/prefer-readonly-parameter-types */

const responseMessage = (): EveMessage => ({
  id: "seed_message_1",
  metadata: { modelId: "gateway/anthropic/claude-sonnet-4" },
  parts: [{ text: "The answer", type: "text" }],
  role: "assistant",
});
/* oxlint-disable typescript/prefer-readonly-parameter-types, unicorn/no-null -- ForkProbe: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including value: ReturnType<typeof useEveFork>); unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

const ForkProbe = ({
  onValue,
}: {
  readonly onValue: (value: ReturnType<typeof useEveFork>) => void;
}): null => {
  onValue(useEveFork(ownerId, conversationId));
  return null;
};
/* oxlint-enable typescript/prefer-readonly-parameter-types, unicorn/no-null */

/* oxlint-disable id-length, no-undefined, typescript/explicit-function-return-type -- required: id-length: retain conventional event, index, and generic identifiers in this existing callback contract; no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result. */

const required = <T,>(value: T | undefined) => {
  if (value === undefined) {
    throw new Error("Expected fork controller");
  }
  return value;
};
/* oxlint-enable id-length, no-undefined, typescript/explicit-function-return-type */

/* oxlint-disable id-length, typescript/explicit-function-return-type -- deferred: id-length: retain conventional event, index, and generic identifiers in this existing callback contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result. */

const deferred = <T,>() => {
  const { promise, reject, resolve } = Promise.withResolvers<T>();
  return { promise, reject, resolve };
};
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve flushEffects's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable id-length, typescript/explicit-function-return-type */

const flushEffects = async (): Promise<void> => {
  // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
  await act(async () => {
    await Promise.resolve();
  });
};
/* oxlint-enable oxc/no-async-await */
afterEach(() => {
  mocks.resolveCreationRequest.mockReset();
  mocks.restoreAttachments.mockReset();
  mocks.openRuntime.mockReset();
  vi.unstubAllGlobals();
});
/* oxlint-disable init-declarations, max-lines-per-function, max-statements, no-magic-numbers, no-undefined, react-perf/jsx-no-new-function-as-prop, typescript/prefer-readonly-parameter-types -- use-eve-fork.test route: init-declarations: branches initialize this value before use; an eager undefined initializer adds a second missing-value state; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 1); no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; ; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including value). */

describe("useEveFork", () => {
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
  it("opens an inline edit with the original response model and tool", async () => {
    vi.stubGlobal("sessionStorage", storage());
    let fork: ReturnType<typeof useEveFork> | undefined;
    // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
    let renderer: ReturnType<typeof create> | undefined;

    // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
    act(() => {
      // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
      renderer = create(
        <ForkProbe
          onValue={(value) => {
            fork = value;
          }}
        />
      );
    });
    await flushEffects();

    try {
      // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
      await act(async () => {
        await required(fork).begin(userMessage(), undefined, {
          events: [],
          response: responseMessage(),
        });
      });

      expect(mocks.restoreAttachments).not.toHaveBeenCalled();
      expect(required(fork).draft).toBe("Find the answer");
      expect(required(fork).editingMessageId).toBe("seed_message_0");
      expect(required(fork).modelSelection.value).toBe(
        "anthropic/claude-sonnet-4"
      );
      expect(required(fork).selectedTool).toBe("webSearch");
    } finally {
      // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
      act(() => renderer?.unmount());
    }
  });
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
  it("restores a saved edit's multi-model selection", async () => {
    const pendingStorage = storage();
    pendingStorage.setItem(
      `chatjs.eve.pending:${ownerId}:fork:${conversationId}`,
      JSON.stringify({
        fork: { beforeMessageId: "seed_message_0", conversationId },
        forkKind: "edit",
        message: "Find the answer",
        modelIds: ["openai/gpt-4.1", "anthropic/claude-sonnet-4"],
        operationId: "11111111-1111-4111-8111-111111111112",
        selectedTool: "webSearch",
      })
    );
    vi.stubGlobal("sessionStorage", pendingStorage);
    let fork: ReturnType<typeof useEveFork> | undefined;
    // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
    let renderer: ReturnType<typeof create> | undefined;

    // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
    act(() => {
      // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
      renderer = create(
        <ForkProbe
          onValue={(value) => {
            fork = value;
          }}
        />
      );
    });
    await flushEffects();

    try {
      expect(required(fork).modelSelection.value).toEqual({
        "anthropic/claude-sonnet-4": 1,
        "openai/gpt-4.1": 1,
      });
      expect(required(fork).selectedTool).toBe("webSearch");
    } finally {
      // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
      act(() => renderer?.unmount());
    }
  });
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
  it("keeps a restored edit associated with its message after rejection", async () => {
    const pendingStorage = storage();
    pendingStorage.setItem(
      `chatjs.eve.pending:${ownerId}:fork:${conversationId}`,
      JSON.stringify({
        fork: { beforeMessageId: "seed_message_0", conversationId },
        forkKind: "edit",
        message: "Find the answer",
        modelId: "anthropic/claude-sonnet-4",
        operationId: "11111111-1111-4111-8111-111111111113",
        selectedTool: "webSearch",
      })
    );
    vi.stubGlobal("sessionStorage", pendingStorage);
    mocks.resolveCreationRequest.mockRejectedValue(
      new CreationRejectedError("Source is no longer available.")
    );
    let fork: ReturnType<typeof useEveFork> | undefined;
    // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
    let renderer: ReturnType<typeof create> | undefined;

    // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
    act(() => {
      // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
      renderer = create(
        <ForkProbe
          onValue={(value) => {
            fork = value;
          }}
        />
      );
    });
    await flushEffects();

    try {
      // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
      await act(async () => {
        await required(fork).retry();
      });

      expect(required(fork).draft).toBe("Find the answer");
      expect(required(fork).editingBoundary).toBe("seed_message_0");
      expect(required(fork).pending).toBeUndefined();
      expect(required(fork).selectedTool).toBe("webSearch");
    } finally {
      // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
      act(() => renderer?.unmount());
    }
  });
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
  it("keeps a rejected edit open after releasing its saved operation", async () => {
    vi.stubGlobal("sessionStorage", storage());
    mocks.resolveCreationRequest.mockRejectedValue(
      new CreationRejectedError("Source is no longer available.")
    );
    let fork: ReturnType<typeof useEveFork> | undefined;
    // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
    let renderer: ReturnType<typeof create> | undefined;

    // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
    act(() => {
      // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
      renderer = create(
        <ForkProbe
          onValue={(value) => {
            fork = value;
          }}
        />
      );
    });
    await flushEffects();

    try {
      // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
      await act(async () => {
        await required(fork).begin(userMessage());
      });
      // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
      await act(async () => {
        await required(fork).submit();
      });

      expect(required(fork).editingMessageId).toBe("seed_message_0");
      expect(required(fork).pending).toBeUndefined();
      expect(required(fork).locked).toBe(false);
    } finally {
      // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
      act(() => renderer?.unmount());
    }
  });
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
  it("does not replace an open inline edit with another message action", async () => {
    vi.stubGlobal("sessionStorage", storage());
    let fork: ReturnType<typeof useEveFork> | undefined;
    // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
    let renderer: ReturnType<typeof create> | undefined;

    // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
    act(() => {
      // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
      renderer = create(
        <ForkProbe
          onValue={(value) => {
            fork = value;
          }}
        />
      );
    });
    await flushEffects();

    try {
      // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
      await act(async () => {
        await required(fork).begin(userMessage());
      });
      // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
      act(() => required(fork).setDraft("Keep this edit draft."));
      // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
      await act(async () => {
        await required(fork).begin({
          ...userMessage(),
          id: "seed_message_2",
          parts: [{ text: "A different message", type: "text" }],
        });
      });

      expect(required(fork).editingMessageId).toBe("seed_message_0");
      expect(required(fork).draft).toBe("Keep this edit draft.");
    } finally {
      // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
      act(() => renderer?.unmount());
    }
  });
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
  it("clears fulfilled edit state in the client navigation transition", async () => {
    const pendingStorage = storage();
    let fork: ReturnType<typeof useEveFork> | undefined;
    vi.stubGlobal("sessionStorage", pendingStorage);
    mocks.resolveCreationRequest.mockImplementation(
      (currentStorage: Storage) => {
        currentStorage.removeItem(
          `chatjs.eve.pending:${ownerId}:fork:${conversationId}`
        );
        return {
          group: undefined,
          id: "11111111-1111-4111-8111-111111111114",
          sessionId: "session",
        };
      }
    );
    // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
    let renderer: ReturnType<typeof create> | undefined;

    // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
    act(() => {
      // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
      renderer = create(
        <ForkProbe
          onValue={(value) => {
            fork = value;
          }}
        />
      );
    });
    await flushEffects();

    try {
      // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
      await act(async () => {
        await required(fork).begin(userMessage());
      });
      // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
      await act(async () => {
        await required(fork).submit();
      });

      expect(mocks.openRuntime).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "11111111-1111-4111-8111-111111111114",
          ownerId,
        })
      );
      expect(required(fork).pending).toBeUndefined();
      expect(required(fork).editingMessageId).toBeUndefined();
      expect(required(fork).editingBoundary).toBeUndefined();
      expect(required(fork).draft).toBe("");
      expect(required(fork).selectedTool).toBeNull();
      expect(required(fork).files.attachments).toEqual([]);
      expect(
        pendingStorage.getItem(
          `chatjs.eve.pending:${ownerId}:fork:${conversationId}`
        )
      ).toBeNull();
    } finally {
      // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
      act(() => renderer?.unmount());
    }
  });
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
  it("does not replace an unconfirmed edit with another saved operation", async () => {
    vi.stubGlobal("sessionStorage", storage());
    mocks.resolveCreationRequest.mockRejectedValue(
      new Error("Creation is unconfirmed.")
    );
    let fork: ReturnType<typeof useEveFork> | undefined;
    // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
    let renderer: ReturnType<typeof create> | undefined;

    // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
    act(() => {
      // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
      renderer = create(
        <ForkProbe
          onValue={(value) => {
            fork = value;
          }}
        />
      );
    });
    await flushEffects();

    try {
      // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
      await act(async () => {
        await required(fork).begin(userMessage());
      });
      // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
      await act(async () => {
        await required(fork).submit();
      });
      // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
      await act(async () => {
        await required(fork).submit();
      });

      expect(required(fork).pending).toBeDefined();
      expect(mocks.resolveCreationRequest).toHaveBeenCalledTimes(1);
    } finally {
      // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
      act(() => renderer?.unmount());
    }
  });
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
  it("keeps a delayed comparison's exact operation available for recovery", async () => {
    const pendingStorage = storage();
    const delayed = deferred<string>();
    vi.stubGlobal("sessionStorage", pendingStorage);
    mocks.resolveCreationRequest.mockImplementation(
      async (currentStorage: Storage) => {
        const id = await delayed.promise;
        currentStorage.removeItem(
          `chatjs.eve.pending:${ownerId}:fork:${conversationId}`
        );
        return { group: undefined, id, sessionId: "session" };
      }
    );
    let fork: ReturnType<typeof useEveFork> | undefined;
    // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
    let renderer: ReturnType<typeof create> | undefined;

    // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
    act(() => {
      // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
      renderer = create(
        <ForkProbe
          onValue={(value) => {
            fork = value;
          }}
        />
      );
    });
    await flushEffects();

    try {
      let request: Promise<void> | undefined;
      // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
      act(() => {
        request = required(fork).compare(
          "Compare this request",
          ["openai/gpt-4.1", "anthropic/claude-sonnet-4"],
          "turn_1"
        );
      });
      await flushEffects();

      const operation = required(required(fork).pending);
      expect(operation).toMatchObject({
        message: "Compare this request",
        modelIds: ["openai/gpt-4.1", "anthropic/claude-sonnet-4"],
      });
      expect(
        pendingStorage.getItem(
          `chatjs.eve.pending:${ownerId}:fork:${conversationId}`
        )
      ).toContain(operation.operationId);

      delayed.resolve("11111111-1111-4111-8111-111111111115");
      // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
      await act(async () => {
        await request;
      });
      expect(required(fork).pending).toBeUndefined();
      expect(
        pendingStorage.getItem(
          `chatjs.eve.pending:${ownerId}:fork:${conversationId}`
        )
      ).toBeNull();
    } finally {
      // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
      act(() => renderer?.unmount());
    }
  });
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
  it("retries an unconfirmed comparison with its original operation identity", async () => {
    const pendingStorage = storage();
    vi.stubGlobal("sessionStorage", pendingStorage);
    mocks.resolveCreationRequest.mockRejectedValueOnce(
      new Error("Comparison is unconfirmed.")
    );
    let fork: ReturnType<typeof useEveFork> | undefined;
    // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
    let renderer: ReturnType<typeof create> | undefined;

    // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
    act(() => {
      // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
      renderer = create(
        <ForkProbe
          onValue={(value) => {
            fork = value;
          }}
        />
      );
    });
    await flushEffects();

    try {
      // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
      await act(async () => {
        await required(fork).compare(
          "Keep the operation",
          ["openai/gpt-4.1", "anthropic/claude-sonnet-4"],
          "turn_1"
        );
      });
      const original = required(required(fork).pending);

      mocks.resolveCreationRequest.mockResolvedValueOnce({
        group: undefined,
        id: "11111111-1111-4111-8111-111111111116",
        sessionId: "session",
      });
      // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
      await act(async () => {
        await required(fork).retry();
      });

      expect(mocks.resolveCreationRequest.mock.calls[1]?.[2]).toEqual(original);
    } finally {
      // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
      act(() => renderer?.unmount());
    }
  });
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
  it("restores historical attachments by message identity without uploads installed", async () => {
    vi.stubGlobal("sessionStorage", storage());
    const attachment = {
      contentType: "application/pdf",
      digest: "restored-digest",
      name: "notes.pdf",
      url: "/api/files/restored-notes.pdf",
    };
    mocks.restoreAttachments.mockResolvedValueOnce([attachment]);
    let fork: ReturnType<typeof useEveFork> | undefined;
    // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
    let renderer: ReturnType<typeof create> | undefined;
    // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
    act(() => {
      // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
      renderer = create(
        <ForkProbe
          onValue={(value) => {
            fork = value;
          }}
        />
      );
    });
    await flushEffects();
    try {
      // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
      await act(async () => {
        await required(fork).begin(
          userMessage([
            {
              filename: "notes.pdf",
              mediaType: "application/pdf",
              type: "file",
              url: "/api/files/original-notes.pdf",
            },
          ])
        );
      });
      expect(mocks.restoreAttachments).toHaveBeenCalledExactlyOnceWith({
        conversationId,
        messageId: "seed_message_0",
      });
      expect(required(fork).files.attachments).toEqual([attachment]);
      expect(required(fork).editingMessageId).toBe("seed_message_0");
      expect(required(fork).locked).toBe(false);
    } finally {
      // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
      act(() => renderer?.unmount());
    }
  });
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
  it("locks an inline edit when an original attachment cannot be restored", async () => {
    vi.stubGlobal("sessionStorage", storage());
    vi.stubGlobal("window", { location: { origin: "https://chatjs.example" } });
    mocks.restoreAttachments.mockRejectedValue(
      new Error("Unable to restore attachment.")
    );
    let fork: ReturnType<typeof useEveFork> | undefined;
    // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
    let renderer: ReturnType<typeof create> | undefined;

    // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
    act(() => {
      // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
      renderer = create(
        <ForkProbe
          onValue={(value) => {
            fork = value;
          }}
        />
      );
    });
    await flushEffects();

    try {
      // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
      await act(async () => {
        await required(fork).begin(
          userMessage([
            {
              filename: "notes.pdf",
              mediaType: "application/pdf",
              type: "file",
              url: "https://chatjs.example/api/files/notes.pdf",
            },
          ])
        );
      });

      expect(required(fork).editingMessageId).toBe("seed_message_0");
      expect(required(fork).locked).toBe(true);
      expect(required(fork).error).toBe("Unable to restore attachment.");
      expect(mocks.restoreAttachments).toHaveBeenCalledWith({
        conversationId,
        messageId: "seed_message_0",
      });
    } finally {
      // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
      act(() => renderer?.unmount());
    }
  });
  /* oxlint-enable oxc/no-async-await */
});
/* oxlint-enable init-declarations, max-lines-per-function, max-statements, no-magic-numbers, no-undefined, react-perf/jsx-no-new-function-as-prop, typescript/prefer-readonly-parameter-types */

/* oxlint-disable max-lines -- use-eve-fork.test keeps its cohesive feature and related render helpers together; splitting this module requires a separate public-boundary review. This exception covers the file-length metric. */
