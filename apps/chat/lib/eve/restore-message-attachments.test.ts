import { beforeEach, expect, it, vi } from "vitest";

import type { getFileMetadata } from "@/lib/file-storage";
import { restoreMessageAttachments } from "./restore-message-attachments";

const mocks = vi.hoisted(() => {
  const replayOrder: string[] = [];
  const messages: {
    id: string;
    role: string;
    parts: {
      type: string;
      mediaType: string;
      url?: string;
      filename?: string;
    }[];
  }[] = [];
  return {
    access: vi.fn(),
    conversation: vi.fn(),
    download: vi.fn(),
    messages,
    metadata: vi.fn(),
    reduce: vi.fn((state: Readonly<{ messages: readonly unknown[] }>) => state),
    replayOrder,
    reserve: vi.fn(),
    snapshot: vi.fn(),
    upload: vi.fn(),
  };
});
vi.mock("../config", () => ({ config: { attachments: { maxBytes: 10 } } }));
vi.mock("../db/eve-queries", () => ({
  getEveConversation: mocks.conversation,
}));
vi.mock("../db/eve-files", () => ({
  canReadEveFile: mocks.access,
  reserveEveUpload: mocks.reserve,
  writeEveUpload: async (
    _owner: string,
    _key: string,
    write: () => Promise<unknown>
  ): Promise<unknown> => await write(),
}));
vi.mock("../file-storage", () => ({
  createFileId: (): string => "abcdefghijklmnopqrstuvwx.png",
  downloadFile: mocks.download,
  getFileMetadata: mocks.metadata,
  uploadFileAtKey: mocks.upload,
}));
vi.mock("./server", () => ({ assertEveConfigured: vi.fn() }));
vi.mock("./connection-options", () => ({
  getEveConnectionOptions: (): Record<string, never> => ({}),
}));
vi.mock("eve/client", () => ({
  Client: class {
    public sessions = {
      attach: (): Pick<typeof mocks, "snapshot"> => ({
        snapshot: mocks.snapshot,
      }),
    };
  },
  defaultMessageReducer: (): {
    initial: () => Pick<typeof mocks, "messages">;
    reduce: typeof mocks.reduce;
  } => {
    mocks.replayOrder.push("factory");
    return {
      initial: (): Pick<typeof mocks, "messages"> => {
        mocks.replayOrder.push("initial");
        return { messages: mocks.messages };
      },
      reduce: mocks.reduce,
    };
  },
}));
const input = { conversationId: "conversation", messageId: "message" };
const replayEvents = [
  {
    data: { messages: [] },
    meta: { at: "2026-10-07T00:00:00Z", id: "first" },
    type: "history.seeded",
  },
  {
    data: { messages: [] },
    meta: { at: "2026-10-07T00:00:01Z", id: "second" },
    type: "history.seeded",
  },
];
beforeEach(() => {
  vi.clearAllMocks();
  mocks.replayOrder.length = 0;
  mocks.conversation.mockResolvedValue({
    sessionId: "session",
    state: "bound",
  });
  mocks.snapshot.mockResolvedValue({ events: [] });
  mocks.access.mockResolvedValue({ allowed: true });
  mocks.metadata.mockResolvedValue({ size: 3, type: "image/png" });
  mocks.download.mockResolvedValue(
    new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" })
  );
  mocks.upload.mockResolvedValue({
    url: "/api/files/abcdefghijklmnopqrstuvwx.png",
  });
  mocks.messages = [
    {
      id: "message",
      parts: [
        {
          filename: "photo.png",
          mediaType: "image/png",
          type: "file",
          url: "data:image/png;base64,AQID",
        },
      ],
      role: "user",
    },
  ];
});
it("restores exact trusted inline history without an installed upload feature", async () => {
  const attachments = await restoreMessageAttachments("owner", input);
  const expectedDigest: unknown = expect.stringMatching(/^[a-f0-9]{64}$/u);
  expect(attachments).toEqual([
    expect.objectContaining({
      contentType: "image/png",
      digest: expectedDigest,
      name: "photo.png",
      url: "/api/files/abcdefghijklmnopqrstuvwx.png",
    }),
  ]);
  expect(mocks.reserve).toHaveBeenCalledWith(
    "owner",
    "abcdefghijklmnopqrstuvwx.png"
  );
  expect(new Uint8Array(mocks.upload.mock.calls[0]?.[2])).toEqual(
    new Uint8Array([1, 2, 3])
  );
});
it("replays ordered snapshot events through the reducer before restoring", async () => {
  const [first, second] = replayEvents;
  mocks.snapshot.mockResolvedValue({ events: replayEvents });
  const firstState = {
    messages: [
      ...mocks.messages,
      { id: "replayed-first", parts: [], role: "user" },
    ],
  };
  const finalState = {
    messages: [
      ...firstState.messages,
      { id: "replayed-second", parts: [], role: "assistant" },
    ],
  };
  mocks.reduce
    .mockImplementationOnce(() => firstState)
    .mockImplementationOnce(() => finalState);
  await restoreMessageAttachments("owner", input);
  expect(mocks.reduce.mock.calls).toEqual([
    [{ messages: mocks.messages }, first],
    [firstState, second],
  ]);
  expect(mocks.reduce.mock.contexts[0]).toBe(mocks.reduce.mock.contexts[1]);
  expect(mocks.reduce.mock.contexts[0]).toHaveProperty("initial");
  expect(mocks.reduce.mock.contexts[0]).toHaveProperty("reduce", mocks.reduce);
});
it("propagates reducer failures and stops replay", async () => {
  const [first, second] = replayEvents;
  const failure = new Error("Reducer failed");
  mocks.snapshot.mockResolvedValue({ events: replayEvents });
  mocks.reduce
    .mockImplementationOnce(() => ({
      messages: [
        ...mocks.messages,
        { id: "replayed-first", parts: [], role: "user" },
      ],
    }))
    .mockImplementationOnce(() => {
      throw failure;
    });
  await expect(restoreMessageAttachments("owner", input)).rejects.toBe(failure);
  expect(mocks.reduce.mock.calls).toEqual([
    [{ messages: mocks.messages }, first],
    [
      {
        messages: [
          ...mocks.messages,
          { id: "replayed-first", parts: [], role: "user" },
        ],
      },
      second,
    ],
  ]);
  expect(mocks.reserve).not.toHaveBeenCalled();
});
it("requires owned bound history and a native user message before copying", async () => {
  mocks.conversation.mockResolvedValue(null);
  await expect(restoreMessageAttachments("stranger", input)).rejects.toThrow(
    "Conversation is unavailable"
  );
  expect(mocks.snapshot).not.toHaveBeenCalled();
  mocks.conversation.mockResolvedValue({
    sessionId: "session",
    state: "bound",
  });
  await expect(
    restoreMessageAttachments("owner", { ...input, messageId: "missing" })
  ).rejects.toThrow("Message is unavailable");
  expect(mocks.reserve).not.toHaveBeenCalled();
});
it("rechecks file access and size and never fetches a remote history URL", async () => {
  const part = mocks.messages.at(0)?.parts[0];
  if (!part) {
    throw new Error("Missing native fixture");
  }
  part.url = "https://foreign.example.test/file.png";
  await expect(restoreMessageAttachments("owner", input)).rejects.toThrow(
    "Invalid attachment reference"
  );
  expect(mocks.download).not.toHaveBeenCalled();
  part.url = "/api/files/abcdefghijklmnopqrstuvwx.png";
  mocks.access.mockResolvedValue({ allowed: false });
  await expect(restoreMessageAttachments("owner", input)).rejects.toThrow(
    "unavailable for editing"
  );
  expect(mocks.download).not.toHaveBeenCalled();
  mocks.access.mockResolvedValue({ allowed: true });
  mocks.download.mockResolvedValue(
    new Blob(["oversized historical image"], { type: "image/png" })
  );
  await expect(restoreMessageAttachments("owner", input)).rejects.toThrow(
    "unsupported type or size"
  );
  expect(mocks.reserve).not.toHaveBeenCalled();
});
it("rejects oversized metadata before downloading or reserving", async () => {
  mocks.messages[0].parts[0].url = "/api/files/abcdefghijklmnopqrstuvwx.png";
  mocks.metadata.mockResolvedValue({ size: 11, type: "image/png" });
  await expect(restoreMessageAttachments("owner", input)).rejects.toThrow(
    "unsupported type or size"
  );
  expect(mocks.download).not.toHaveBeenCalled();
  expect(mocks.reserve).not.toHaveBeenCalled();
});
it.each(["AQID!!!", "", "AQIDBAUGBwgJCgsMDQ4P"])(
  "rejects malformed or oversized inline payload %s before copying",
  async (encoded) => {
    mocks.messages[0].parts[0].url = `data:image/png;base64,${encoded}`;
    await expect(restoreMessageAttachments("owner", input)).rejects.toThrow();
    expect(mocks.reserve).not.toHaveBeenCalled();
    expect(mocks.upload).not.toHaveBeenCalled();
  }
);
it("rejects a remote reference before storage access", async () => {
  mocks.messages[0].parts[0].url = "https://example.com/photo.png";
  await expect(restoreMessageAttachments("owner", input)).rejects.toThrow(
    "Invalid attachment reference"
  );
  expect(mocks.access).not.toHaveBeenCalled();
  expect(mocks.download).not.toHaveBeenCalled();
});
it.each(["missing", "inaccessible", "oversized", "unsupported", "malformed"])(
  "rejects a later %s attachment before reserving or copying any file",
  async (failure) => {
    const part = {
      filename: "second.png",
      mediaType: "image/png",
      type: "file",
      url: "/api/files/abcdefghijklmnopqrstuvwx.png",
    };
    mocks.messages[0].parts.push(part);
    if (failure === "missing") {
      mocks.metadata.mockRejectedValue(new Error("File missing"));
    } else if (failure === "inaccessible") {
      mocks.access.mockResolvedValue({ allowed: false });
    } else if (failure === "oversized") {
      mocks.metadata.mockResolvedValue({ size: 11, type: "image/png" });
    } else if (failure === "unsupported") {
      mocks.metadata.mockResolvedValue({ size: 3, type: "text/plain" });
    } else {
      part.url = "data:image/png;base64,AQID!!!";
    }
    await expect(restoreMessageAttachments("owner", input)).rejects.toThrow();
    expect(mocks.reserve).not.toHaveBeenCalled();
    expect(mocks.download).not.toHaveBeenCalled();
    expect(mocks.upload).not.toHaveBeenCalled();
  }
);
it("preflights all files then copies valid mixed history in order", async () => {
  mocks.messages[0].parts.push({
    filename: "second.png",
    mediaType: "image/png",
    type: "file",
    url: "/api/files/abcdefghijklmnopqrstuvwx.png",
  });
  const attachments = await restoreMessageAttachments("owner", input);
  expect(attachments.map((attachment) => attachment.name)).toEqual([
    "photo.png",
    "second.png",
  ]);
  expect(mocks.metadata.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.reserve.mock.invocationCallOrder[0]
  );
  expect(mocks.upload).toHaveBeenCalledTimes(2);
});

it("admits adjacent inline parts before queued mutations run", async () => {
  const reads: string[] = [];
  mocks.messages = [
    {
      id: "message",
      parts: [
        {
          filename: "first.png",
          mediaType: "image/png",
          type: "file",
          get url(): string {
            reads.push("first");
            queueMicrotask(() => {
              reads.push("queued");
            });
            return "data:image/png;base64,AQID";
          },
        },
        {
          filename: "second.png",
          mediaType: "image/png",
          type: "file",
          get url(): string {
            reads.push("second");
            return "data:image/png;base64,AQID";
          },
        },
      ],
      role: "user",
    },
  ];
  await restoreMessageAttachments("owner", input);
  expect(reads).toEqual(["first", "second", "queued"]);
});

it("initializes the reducer before reading original snapshot events", async () => {
  mocks.snapshot.mockResolvedValue({
    get events(): never[] {
      mocks.replayOrder.push("events");
      return [];
    },
  });
  await restoreMessageAttachments("owner", input);
  expect(mocks.replayOrder).toEqual(["factory", "initial", "events"]);
});

it("reads original stored history before queued next-part mutations", async () => {
  const second = {
    filename: "second.png",
    mediaType: "image/png",
    type: "file",
    url: "data:image/png;base64,AQID",
  };
  const body = new Blob(["abc"], { type: "image/png" });
  const metadata: Awaited<ReturnType<typeof getFileMetadata>> = {
    arrayBuffer: async () => await body.arrayBuffer(),
    blob: vi.fn<() => Promise<Blob>>().mockResolvedValue(body),
    key: "abcdefghijklmnopqrstuvwx.png",
    name: "first.png",
    get size(): number {
      queueMicrotask(() => {
        second.url = "invalid-after-metadata";
      });
      return body.size;
    },
    stream: () => body.stream(),
    text: async () => await body.text(),
    type: body.type,
  };
  mocks.metadata.mockResolvedValue(metadata);
  mocks.messages = [
    {
      id: "message",
      parts: [
        {
          filename: "first.png",
          mediaType: "image/png",
          type: "file",
          url: "/api/files/abcdefghijklmnopqrstuvwx.png",
        },
        second,
      ],
      role: "user",
    },
  ];
  const attachments = await restoreMessageAttachments("owner", input);
  expect(attachments.map((attachment) => attachment.name)).toEqual([
    "first.png",
    "second.png",
  ]);
  expect(mocks.download).toHaveBeenCalledWith("abcdefghijklmnopqrstuvwx.png");
});

it("captures every original descriptor before bounded ownership checks and preserves copy order", async () => {
  const keys = Array.from(
    { length: 5 },
    (_, index) => `${String.fromCodePoint(97 + index).repeat(24)}.png`
  );
  const parts = keys.map((key, index) => ({
    filename: `${index}.png`,
    mediaType: "image/png",
    type: "file",
    url: `/api/files/${key}`,
  }));
  mocks.messages[0].parts = parts;
  const gates = keys.map(() => Promise.withResolvers<{ allowed: boolean }>());
  mocks.access.mockImplementation(
    async (key: string) => await gates[keys.indexOf(key)].promise
  );
  const restoring = restoreMessageAttachments("owner", input);
  await vi.waitFor(() => {
    expect(mocks.access).toHaveBeenCalledTimes(4);
  });
  parts[4].url = "https://untrusted.example/changed.png";
  for (const gate of gates.slice(0, 3)) {
    gate.resolve({ allowed: true });
  }
  await Promise.resolve();
  expect(mocks.access).toHaveBeenCalledTimes(4);
  expect(mocks.reserve).not.toHaveBeenCalled();
  gates[3].resolve({ allowed: true });
  await vi.waitFor(() => {
    expect(mocks.access).toHaveBeenCalledTimes(5);
  });
  expect(mocks.access).toHaveBeenLastCalledWith(keys[4], "owner");
  expect(mocks.download).not.toHaveBeenCalled();
  gates[4].resolve({ allowed: true });
  const restored = await restoring;
  expect(restored.map((attachment) => attachment.name)).toEqual(
    parts.map((part) => part.filename)
  );
  expect(
    mocks.download.mock.calls.map(([key]: readonly unknown[]) => key)
  ).toEqual(keys);
});

it("drains admitted preflights after ownership failure without reading that key or uploading", async () => {
  const keys = ["a".repeat(24), "b".repeat(24)].map((key) => `${key}.png`);
  mocks.messages[0].parts = keys.map((key) => ({
    mediaType: "image/png",
    type: "file",
    url: `/api/files/${key}`,
  }));
  const metadata = Promise.withResolvers<{ size: number; type: string }>();
  mocks.access.mockImplementation(
    async (key: string) =>
      await Promise.resolve({
        allowed: key === keys[1],
      })
  );
  mocks.metadata.mockReturnValue(metadata.promise);
  const restoring = restoreMessageAttachments("owner", input);
  const rejected = expect(restoring).rejects.toThrow("unavailable for editing");
  let settled = false;
  void restoring.catch(() => {
    settled = true;
  });
  await vi.waitFor(() => {
    expect(mocks.metadata).toHaveBeenCalledOnce();
  });
  expect(mocks.metadata).toHaveBeenCalledWith(keys[1]);
  expect(settled).toBe(false);
  metadata.resolve({ size: 3, type: "image/png" });
  await rejected;
  expect(mocks.reserve).not.toHaveBeenCalled();
  expect(mocks.download).not.toHaveBeenCalled();
});
