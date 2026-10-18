import type { EveMessage } from "eve/client";
import React, { act } from "react";
import { createDomHarness } from "@/components/test-dom-harness";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CreationRejectedError } from "@/lib/eve/create-conversation";
import { eveToolMetadata } from "@/lib/eve/message-tool-selection";
import type { ReadonlyEveMessagePart } from "@/lib/eve/readonly-message-types";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

import { useEveFork } from "@/components/eve/use-eve-fork";

const mocks = vi.hoisted(() => ({
  openRuntime: vi.fn(),
  resolveCreationRequest: vi.fn(),
  restoreAttachments: vi.fn(),
}));

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

vi.mock("@/components/eve/eve-logical-context", () => ({
  useEveRuntime: () => mocks.openRuntime,
}));

vi.mock("@/lib/eve/resolve-creation-request", () => ({
  resolveCreationRequest: mocks.resolveCreationRequest,
}));

vi.mock("@/features/installed-uploads", () => ({
  attachmentUploads: {
    controls: [],
    useUploads: () => ({
      uploadQueue: [],
    }),
  },
}));

vi.mock("@/providers/default-model-provider", () => ({
  useDefaultModel: () => "openai/gpt-4.1",
}));

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

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const conversationId = "11111111-1111-4111-8111-111111111111";
const ownerId = "test-owner";

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

const userMessage = (
  parts: readonly ReadonlyEveMessagePart[] = []
): EveMessage => ({
  id: "seed_message_0",
  metadata: { custom: eveToolMetadata("webSearch") },
  parts: [{ text: "Find the answer", type: "text" }, ...parts],
  role: "user" as const,
});

const responseMessage = (): EveMessage => ({
  id: "seed_message_1",
  metadata: { modelId: "gateway/anthropic/claude-sonnet-4" },
  parts: [{ text: "The answer", type: "text" }],
  role: "assistant",
});

const ForkProbe = ({
  onValue,
}: {
  readonly onValue: (
    value: ReadonlyNativeSurface<ReturnType<typeof useEveFork>>
  ) => void;
}): null => {
  onValue(useEveFork(ownerId, conversationId));
  return null;
};

const required = <T,>(value: T | undefined) => {
  if (value === undefined) {
    throw new Error("Expected fork controller");
  }
  return value;
};

const deferred = <T,>() => {
  const { promise, reject, resolve } = Promise.withResolvers<T>();
  return { promise, reject, resolve };
};

const flushEffects = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve();
  });
};
afterEach(() => {
  mocks.resolveCreationRequest.mockReset();
  mocks.restoreAttachments.mockReset();
  mocks.openRuntime.mockReset();
  vi.unstubAllGlobals();
});

describe("useEveFork", () => {
  it("opens an inline edit with the original response model and tool", async () => {
    vi.stubGlobal("sessionStorage", storage());
    let fork: ReadonlyNativeSurface<ReturnType<typeof useEveFork>> | undefined;
    let renderer: ReturnType<typeof createDomHarness> | undefined;

    act(() => {
      renderer = createDomHarness(
        <ForkProbe
          onValue={(
            value: ReadonlyNativeSurface<ReturnType<typeof useEveFork>>
          ) => {
            fork = value;
          }}
        />
      );
    });
    await flushEffects();

    try {
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
      act(() => {
        if (renderer) {
          renderer.unmount();
        }
      });
    }
  });
  it("restores a saved edit's multi-model selection", async () => {
    const pendingStorage = storage();
    pendingStorage.setItem(
      `chatjs.eve.pending:${ownerId}:fork:${conversationId}`,
      JSON.stringify({
        fork: { conversationId },
        forkKind: "edit",
        message: "Find the answer",
        modelIds: ["openai/gpt-4.1", "anthropic/claude-sonnet-4"],
        operationId: "11111111-1111-4111-8111-111111111112",
        selectedTool: "webSearch",
      })
    );
    vi.stubGlobal("sessionStorage", pendingStorage);
    let fork: ReadonlyNativeSurface<ReturnType<typeof useEveFork>> | undefined;
    let renderer: ReturnType<typeof createDomHarness> | undefined;

    act(() => {
      renderer = createDomHarness(
        <ForkProbe
          onValue={(
            value: ReadonlyNativeSurface<ReturnType<typeof useEveFork>>
          ) => {
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
      act(() => {
        if (renderer) {
          renderer.unmount();
        }
      });
    }
  });
  it("keeps a restored copy prompt after rejection without a historical boundary", async () => {
    const pendingStorage = storage();
    pendingStorage.setItem(
      `chatjs.eve.pending:${ownerId}:fork:${conversationId}`,
      JSON.stringify({
        fork: { conversationId },
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
    let fork: ReadonlyNativeSurface<ReturnType<typeof useEveFork>> | undefined;
    let renderer: ReturnType<typeof createDomHarness> | undefined;

    act(() => {
      renderer = createDomHarness(
        <ForkProbe
          onValue={(
            value: ReadonlyNativeSurface<ReturnType<typeof useEveFork>>
          ) => {
            fork = value;
          }}
        />
      );
    });
    await flushEffects();

    try {
      await act(async () => {
        await required(fork).retry();
      });

      expect(required(fork).draft).toBe("Find the answer");
      expect(required(fork).editingBoundary).toBeUndefined();
      expect(required(fork).pending).toBeUndefined();
      expect(required(fork).selectedTool).toBe("webSearch");
    } finally {
      act(() => {
        if (renderer) {
          renderer.unmount();
        }
      });
    }
  });
  it("keeps a rejected edit open after releasing its saved operation", async () => {
    vi.stubGlobal("sessionStorage", storage());
    mocks.resolveCreationRequest.mockRejectedValue(
      new CreationRejectedError("Source is no longer available.")
    );
    let fork: ReadonlyNativeSurface<ReturnType<typeof useEveFork>> | undefined;
    let renderer: ReturnType<typeof createDomHarness> | undefined;

    act(() => {
      renderer = createDomHarness(
        <ForkProbe
          onValue={(
            value: ReadonlyNativeSurface<ReturnType<typeof useEveFork>>
          ) => {
            fork = value;
          }}
        />
      );
    });
    await flushEffects();

    try {
      await act(async () => {
        await required(fork).begin(userMessage());
      });
      await act(async () => {
        await required(fork).submit();
      });

      expect(required(fork).editingMessageId).toBe("seed_message_0");
      expect(required(fork).pending).toBeUndefined();
      expect(required(fork).locked).toBe(false);
    } finally {
      act(() => {
        if (renderer) {
          renderer.unmount();
        }
      });
    }
  });

  it("retains a rejected request and releases its lock when storage cleanup throws", async () => {
    const pendingStorage = storage();
    const removeItem = vi.spyOn(pendingStorage, "removeItem");
    removeItem.mockImplementation(() => {
      throw new Error("Storage is unavailable.");
    });
    vi.stubGlobal("sessionStorage", pendingStorage);
    mocks.resolveCreationRequest.mockRejectedValue(
      new CreationRejectedError("Source is no longer available.")
    );
    let fork: ReadonlyNativeSurface<ReturnType<typeof useEveFork>> | undefined;
    let renderer: ReturnType<typeof createDomHarness> | undefined;

    act(() => {
      renderer = createDomHarness(
        <ForkProbe
          onValue={(
            value: ReadonlyNativeSurface<ReturnType<typeof useEveFork>>
          ) => {
            fork = value;
          }}
        />
      );
    });
    await flushEffects();

    try {
      await act(async () => {
        await required(fork).begin(userMessage());
      });
      await act(async () => {
        await required(fork).submit();
      });

      expect(required(fork).editingMessageId).toBe("seed_message_0");
      expect(required(fork).pending).toBeDefined();
      expect(required(fork).error).toBe(
        "The rejected version request could not be cleared. Keep this tab for recovery."
      );
      expect(removeItem).toHaveBeenCalledOnce();
      expect(required(fork).busy).toBe(false);
      expect(required(fork).rejected).toBe(true);
      removeItem.mockRestore();
      await act(async () => {
        await required(fork).retry();
      });
      expect(required(fork).pending).toBeUndefined();
      expect(required(fork).rejected).toBe(false);
      expect(mocks.resolveCreationRequest).toHaveBeenCalledOnce();
    } finally {
      act(() => {
        if (renderer) {
          renderer.unmount();
        }
      });
    }
  });

  it("does not replace an open inline edit with another message action", async () => {
    vi.stubGlobal("sessionStorage", storage());
    let fork: ReadonlyNativeSurface<ReturnType<typeof useEveFork>> | undefined;
    let renderer: ReturnType<typeof createDomHarness> | undefined;

    act(() => {
      renderer = createDomHarness(
        <ForkProbe
          onValue={(
            value: ReadonlyNativeSurface<ReturnType<typeof useEveFork>>
          ) => {
            fork = value;
          }}
        />
      );
    });
    await flushEffects();

    try {
      await act(async () => {
        await required(fork).begin(userMessage());
      });
      act(() => {
        required(fork).setDraft("Keep this edit draft.");
      });
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
      act(() => {
        if (renderer) {
          renderer.unmount();
        }
      });
    }
  });
  it("clears fulfilled edit state in the client navigation transition", async () => {
    const pendingStorage = storage();
    let fork: ReadonlyNativeSurface<ReturnType<typeof useEveFork>> | undefined;
    vi.stubGlobal("sessionStorage", pendingStorage);
    mocks.resolveCreationRequest.mockImplementation(
      (currentStorage: Readonly<Pick<Storage, "removeItem">>) => {
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
    let renderer: ReturnType<typeof createDomHarness> | undefined;

    act(() => {
      renderer = createDomHarness(
        <ForkProbe
          onValue={(
            value: ReadonlyNativeSurface<ReturnType<typeof useEveFork>>
          ) => {
            fork = value;
          }}
        />
      );
    });
    await flushEffects();

    try {
      await act(async () => {
        await required(fork).begin(userMessage());
      });
      await act(async () => {
        await required(fork).submit();
      });

      expect(mocks.resolveCreationRequest.mock.calls[0]?.[2]).toMatchObject({
        fork: { conversationId, beforeMessageId: "seed_message_0" },
        forkKind: "edit",
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
      act(() => {
        if (renderer) {
          renderer.unmount();
        }
      });
    }
  });
  it("does not replace an unconfirmed edit with another saved operation", async () => {
    vi.stubGlobal("sessionStorage", storage());
    mocks.resolveCreationRequest.mockRejectedValue(
      new Error("Creation is unconfirmed.")
    );
    let fork: ReadonlyNativeSurface<ReturnType<typeof useEveFork>> | undefined;
    let renderer: ReturnType<typeof createDomHarness> | undefined;

    act(() => {
      renderer = createDomHarness(
        <ForkProbe
          onValue={(
            value: ReadonlyNativeSurface<ReturnType<typeof useEveFork>>
          ) => {
            fork = value;
          }}
        />
      );
    });
    await flushEffects();

    try {
      await act(async () => {
        await required(fork).begin(userMessage());
      });
      await act(async () => {
        await required(fork).submit();
      });
      await act(async () => {
        await required(fork).submit();
      });

      expect(required(fork).pending).toBeDefined();
      expect(mocks.resolveCreationRequest).toHaveBeenCalledTimes(1);
    } finally {
      act(() => {
        if (renderer) {
          renderer.unmount();
        }
      });
    }
  });
  it("keeps a delayed comparison's exact operation available for recovery", async () => {
    const pendingStorage = storage();
    const delayed = deferred<string>();
    vi.stubGlobal("sessionStorage", pendingStorage);
    mocks.resolveCreationRequest.mockImplementation(
      async (currentStorage: Readonly<Pick<Storage, "removeItem">>) => {
        const id = await delayed.promise;
        currentStorage.removeItem(
          `chatjs.eve.pending:${ownerId}:fork:${conversationId}`
        );
        return { group: undefined, id, sessionId: "session" };
      }
    );
    let fork: ReadonlyNativeSurface<ReturnType<typeof useEveFork>> | undefined;
    let renderer: ReturnType<typeof createDomHarness> | undefined;

    act(() => {
      renderer = createDomHarness(
        <ForkProbe
          onValue={(
            value: ReadonlyNativeSurface<ReturnType<typeof useEveFork>>
          ) => {
            fork = value;
          }}
        />
      );
    });
    await flushEffects();

    try {
      let request: Promise<void> | undefined;
      act(() => {
        request = required(fork).compare("Compare this request", [
          "openai/gpt-4.1",
          "anthropic/claude-sonnet-4",
        ]);
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
      act(() => {
        if (renderer) {
          renderer.unmount();
        }
      });
    }
  });
  it("retries an unconfirmed comparison with its original operation identity", async () => {
    const pendingStorage = storage();
    vi.stubGlobal("sessionStorage", pendingStorage);
    mocks.resolveCreationRequest.mockRejectedValueOnce(
      new Error("Comparison is unconfirmed.")
    );
    let fork: ReadonlyNativeSurface<ReturnType<typeof useEveFork>> | undefined;
    let renderer: ReturnType<typeof createDomHarness> | undefined;

    act(() => {
      renderer = createDomHarness(
        <ForkProbe
          onValue={(
            value: ReadonlyNativeSurface<ReturnType<typeof useEveFork>>
          ) => {
            fork = value;
          }}
        />
      );
    });
    await flushEffects();

    try {
      await act(async () => {
        await required(fork).compare("Keep the operation", [
          "openai/gpt-4.1",
          "anthropic/claude-sonnet-4",
        ]);
      });
      const original = required(required(fork).pending);

      mocks.resolveCreationRequest.mockResolvedValueOnce({
        group: undefined,
        id: "11111111-1111-4111-8111-111111111116",
        sessionId: "session",
      });
      await act(async () => {
        await required(fork).retry();
      });

      expect(mocks.resolveCreationRequest.mock.calls[1]?.[2]).toEqual(original);
    } finally {
      act(() => {
        if (renderer) {
          renderer.unmount();
        }
      });
    }
  });
  it("restores historical attachments by message identity without uploads installed", async () => {
    vi.stubGlobal("sessionStorage", storage());
    const attachment = {
      contentType: "application/pdf",
      digest: "restored-digest",
      name: "notes.pdf",
      url: "/api/files/restored-notes.pdf",
    };
    mocks.restoreAttachments.mockResolvedValueOnce([attachment]);
    let fork: ReadonlyNativeSurface<ReturnType<typeof useEveFork>> | undefined;
    let renderer: ReturnType<typeof createDomHarness> | undefined;
    act(() => {
      renderer = createDomHarness(
        <ForkProbe
          onValue={(
            value: ReadonlyNativeSurface<ReturnType<typeof useEveFork>>
          ) => {
            fork = value;
          }}
        />
      );
    });
    await flushEffects();
    try {
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
      act(() => {
        if (renderer) {
          renderer.unmount();
        }
      });
    }
  });
  it("locks an inline edit when an original attachment cannot be restored", async () => {
    vi.stubGlobal("sessionStorage", storage());
    mocks.restoreAttachments.mockRejectedValue(
      new Error("Unable to restore attachment.")
    );
    let fork: ReadonlyNativeSurface<ReturnType<typeof useEveFork>> | undefined;
    let renderer: ReturnType<typeof createDomHarness> | undefined;

    act(() => {
      renderer = createDomHarness(
        <ForkProbe
          onValue={(
            value: ReadonlyNativeSurface<ReturnType<typeof useEveFork>>
          ) => {
            fork = value;
          }}
        />
      );
    });
    await flushEffects();

    try {
      await act(async () => {
        await required(fork).begin(
          userMessage([
            {
              filename: "notes.pdf",
              mediaType: "application/pdf",
              type: "file",
              url: `${window.location.origin}/api/files/notes.pdf`,
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
      act(() => {
        if (renderer) {
          renderer.unmount();
        }
      });
    }
  });
});
