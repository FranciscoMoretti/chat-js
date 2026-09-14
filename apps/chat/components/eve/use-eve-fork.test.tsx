import type { EveMessage } from "eve/client";
import { act, create } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CreationRejectedError } from "@/lib/eve/create-conversation";
import { eveToolMetadata } from "@/lib/eve/message-tool-selection";

import { useEveFork } from "./use-eve-fork";

const mocks = vi.hoisted(() => ({
  resolveCreationRequest: vi.fn(),
  restoreEveAttachment: vi.fn(),
  routerPush: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
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

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.routerPush }),
}));

vi.mock("@/lib/eve/resolve-creation-request", () => ({
  resolveCreationRequest: mocks.resolveCreationRequest,
}));

vi.mock("@/lib/eve/restore-attachment", () => ({
  restoreEveAttachment: mocks.restoreEveAttachment,
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

const userMessage = (parts: EveMessage["parts"] = []): EveMessage => ({
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
  onValue: (value: ReturnType<typeof useEveFork>) => void;
}) => {
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

const flushEffects = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

afterEach(() => {
  mocks.resolveCreationRequest.mockReset();
  mocks.restoreEveAttachment.mockReset();
  mocks.routerPush.mockReset();
  vi.unstubAllGlobals();
});

describe("useEveFork", () => {
  it("opens an inline edit with the original response model and tool", async () => {
    vi.stubGlobal("sessionStorage", storage());
    let fork: ReturnType<typeof useEveFork> | undefined;
    let renderer: ReturnType<typeof create> | undefined;

    act(() => {
      renderer = create(<ForkProbe onValue={(value) => (fork = value)} />);
    });
    await flushEffects();

    try {
      await act(async () => {
        await required(fork).begin(userMessage(), undefined, {
          events: [],
          response: responseMessage(),
        });
      });

      expect(required(fork).draft).toBe("Find the answer");
      expect(required(fork).editingMessageId).toBe("seed_message_0");
      expect(required(fork).modelSelection.value).toBe(
        "anthropic/claude-sonnet-4"
      );
      expect(required(fork).selectedTool).toBe("webSearch");
    } finally {
      act(() => renderer?.unmount());
    }
  });

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
    let renderer: ReturnType<typeof create> | undefined;

    act(() => {
      renderer = create(<ForkProbe onValue={(value) => (fork = value)} />);
    });
    await flushEffects();

    try {
      expect(required(fork).modelSelection.value).toEqual({
        "anthropic/claude-sonnet-4": 1,
        "openai/gpt-4.1": 1,
      });
      expect(required(fork).selectedTool).toBe("webSearch");
    } finally {
      act(() => renderer?.unmount());
    }
  });

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
    let renderer: ReturnType<typeof create> | undefined;

    act(() => {
      renderer = create(<ForkProbe onValue={(value) => (fork = value)} />);
    });
    await flushEffects();

    try {
      await act(async () => {
        await required(fork).retry();
      });

      expect(required(fork).draft).toBe("Find the answer");
      expect(required(fork).editingBoundary).toBe("seed_message_0");
      expect(required(fork).pending).toBeUndefined();
      expect(required(fork).selectedTool).toBe("webSearch");
    } finally {
      act(() => renderer?.unmount());
    }
  });

  it("keeps a rejected edit open after releasing its saved operation", async () => {
    vi.stubGlobal("sessionStorage", storage());
    mocks.resolveCreationRequest.mockRejectedValue(
      new CreationRejectedError("Source is no longer available.")
    );
    let fork: ReturnType<typeof useEveFork> | undefined;
    let renderer: ReturnType<typeof create> | undefined;

    act(() => {
      renderer = create(<ForkProbe onValue={(value) => (fork = value)} />);
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
      act(() => renderer?.unmount());
    }
  });

  it("does not replace an open inline edit with another message action", async () => {
    vi.stubGlobal("sessionStorage", storage());
    let fork: ReturnType<typeof useEveFork> | undefined;
    let renderer: ReturnType<typeof create> | undefined;

    act(() => {
      renderer = create(<ForkProbe onValue={(value) => (fork = value)} />);
    });
    await flushEffects();

    try {
      await act(async () => {
        await required(fork).begin(userMessage());
      });
      act(() => required(fork).setDraft("Keep this edit draft."));
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
      act(() => renderer?.unmount());
    }
  });

  it("clears fulfilled edit state in the client navigation transition", async () => {
    const pendingStorage = storage();
    let fork: ReturnType<typeof useEveFork> | undefined;
    vi.stubGlobal("sessionStorage", pendingStorage);
    mocks.resolveCreationRequest.mockImplementation(
      (currentStorage: Storage) => {
        currentStorage.removeItem(
          `chatjs.eve.pending:${ownerId}:fork:${conversationId}`
        );
        return "11111111-1111-4111-8111-111111111114";
      }
    );
    let renderer: ReturnType<typeof create> | undefined;

    act(() => {
      renderer = create(<ForkProbe onValue={(value) => (fork = value)} />);
    });
    await flushEffects();

    try {
      await act(async () => {
        await required(fork).begin(userMessage());
      });
      await act(async () => {
        await required(fork).submit();
      });

      expect(mocks.routerPush).toHaveBeenCalledWith(
        "/chat/11111111-1111-4111-8111-111111111114",
        { scroll: false }
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
      act(() => renderer?.unmount());
    }
  });

  it("does not replace an unconfirmed edit with another saved operation", async () => {
    vi.stubGlobal("sessionStorage", storage());
    mocks.resolveCreationRequest.mockRejectedValue(
      new Error("Creation is unconfirmed.")
    );
    let fork: ReturnType<typeof useEveFork> | undefined;
    let renderer: ReturnType<typeof create> | undefined;

    act(() => {
      renderer = create(<ForkProbe onValue={(value) => (fork = value)} />);
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
      act(() => renderer?.unmount());
    }
  });

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
        return id;
      }
    );
    let fork: ReturnType<typeof useEveFork> | undefined;
    let renderer: ReturnType<typeof create> | undefined;

    act(() => {
      renderer = create(<ForkProbe onValue={(value) => (fork = value)} />);
    });
    await flushEffects();

    try {
      let request: Promise<void> | undefined;
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
      ).toContain(operation?.operationId);

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
      act(() => renderer?.unmount());
    }
  });

  it("retries an unconfirmed comparison with its original operation identity", async () => {
    const pendingStorage = storage();
    vi.stubGlobal("sessionStorage", pendingStorage);
    mocks.resolveCreationRequest.mockRejectedValueOnce(
      new Error("Comparison is unconfirmed.")
    );
    let fork: ReturnType<typeof useEveFork> | undefined;
    let renderer: ReturnType<typeof create> | undefined;

    act(() => {
      renderer = create(<ForkProbe onValue={(value) => (fork = value)} />);
    });
    await flushEffects();

    try {
      await act(async () => {
        await required(fork).compare(
          "Keep the operation",
          ["openai/gpt-4.1", "anthropic/claude-sonnet-4"],
          "turn_1"
        );
      });
      const original = required(required(fork).pending);

      mocks.resolveCreationRequest.mockResolvedValueOnce(
        "11111111-1111-4111-8111-111111111116"
      );
      await act(async () => {
        await required(fork).retry();
      });

      expect(mocks.resolveCreationRequest.mock.calls[1]?.[2]).toEqual(original);
    } finally {
      act(() => renderer?.unmount());
    }
  });

  it("locks an inline edit when an original attachment cannot be restored", async () => {
    vi.stubGlobal("sessionStorage", storage());
    vi.stubGlobal("window", { location: { origin: "https://chatjs.example" } });
    mocks.restoreEveAttachment.mockRejectedValue(
      new Error("Unable to restore attachment.")
    );
    let fork: ReturnType<typeof useEveFork> | undefined;
    let renderer: ReturnType<typeof create> | undefined;

    act(() => {
      renderer = create(<ForkProbe onValue={(value) => (fork = value)} />);
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
              url: "https://chatjs.example/api/files/content?key=notes.pdf",
            },
          ])
        );
      });

      expect(required(fork).editingMessageId).toBe("seed_message_0");
      expect(required(fork).locked).toBe(true);
      expect(required(fork).error).toBe("Unable to restore attachment.");
    } finally {
      act(() => renderer?.unmount());
    }
  });
});
