/* oxlint-disable max-lines -- Preserve existing attachment coverage alongside the regression proving inline getter reads precede queued microtasks; splitting this shared native-client fixture solely for the line threshold would duplicate setup. */
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
/* oxlint-disable typescript/promise-function-async --
 * typescript/promise-function-async (#606): vi.mock("../db/eve-files") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
vi.mock("../db/eve-files", () => ({
  canReadEveFile: mocks.access,
  reserveEveUpload: mocks.reserve,
  writeEveUpload: (
    _owner: string,
    _key: string,
    write: () => Promise<unknown>
  ): Promise<unknown> => write(),
}));
/* oxlint-enable typescript/promise-function-async */
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
/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): beforeEach uses 1, 2, 3 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
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
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */
/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): it("restores exact trusted inline history without an installed upload feature") uses 0, 2, 1, 3 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
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
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading 2 from mocks.upload.mock.calls[0]; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */
/* oxlint-disable unicorn/no-null --
 * unicorn/no-null (#570): it("requires owned bound history and a native user message before copying") preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
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
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing input own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    restoreMessageAttachments("owner", { ...input, messageId: "missing" })
  ).rejects.toThrow("Message is unavailable");
  expect(mocks.reserve).not.toHaveBeenCalled();
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable unicorn/no-null */
/* oxlint-disable max-statements, no-magic-numbers --
 * max-statements (#512): it("rechecks file access and size and never fetches a remote history URL") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): it("rechecks file access and size and never fetches a remote history URL") uses 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
it("rechecks file access and size and never fetches a remote history URL", async () => {
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading parts from mocks.messages[0]; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-statements, no-magic-numbers */
/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): it("rejects oversized metadata before downloading or reserving") uses 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
it("rejects oversized metadata before downloading or reserving", async () => {
  mocks.messages[0].parts[0].url = "/api/files/abcdefghijklmnopqrstuvwx.png";
  mocks.metadata.mockResolvedValue({ size: 11, type: "image/png" });
  await expect(restoreMessageAttachments("owner", input)).rejects.toThrow(
    "unsupported type or size"
  );
  expect(mocks.download).not.toHaveBeenCalled();
  expect(mocks.reserve).not.toHaveBeenCalled();
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it.each(["AQID!!!", "", "AQIDBAUGBwgJCgsMDQ4P"])'s awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */
/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): it.each(["AQID!!!", "", "AQIDBAUGBwgJCgsMDQ4P"])("rejects malformed or oversized inli uses 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
it.each(["AQID!!!", "", "AQIDBAUGBwgJCgsMDQ4P"])(
  "rejects malformed or oversized inline payload %s before copying",
  async (encoded) => {
    mocks.messages[0].parts[0].url = `data:image/png;base64,${encoded}`;
    await expect(restoreMessageAttachments("owner", input)).rejects.toThrow();
    expect(mocks.reserve).not.toHaveBeenCalled();
    expect(mocks.upload).not.toHaveBeenCalled();
  }
);
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */
/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): it("rejects a remote reference before storage access") uses 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
it("rejects a remote reference before storage access", async () => {
  mocks.messages[0].parts[0].url = "https://example.com/photo.png";
  await expect(restoreMessageAttachments("owner", input)).rejects.toThrow(
    "Invalid attachment reference"
  );
  expect(mocks.access).not.toHaveBeenCalled();
  expect(mocks.download).not.toHaveBeenCalled();
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it.each(["missing", "inaccessible", "oversized", "unsupported", "malformed"])'s awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */
/* oxlint-disable max-statements, no-magic-numbers --
 * max-statements (#512): it.each(["missing", "inaccessible", "oversized", "unsupported", "malformed"])("reject keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): it.each(["missing", "inaccessible", "oversized", "unsupported", "malformed"])("reject uses 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-statements, no-magic-numbers */
/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): it("preflights all files then copies valid mixed history in order") uses 0, 2 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable no-magic-numbers */

// oxlint-disable-next-line oxc/no-async-await -- Await the completed restore to observe queued microtasks after synchronous inline admission.
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

// oxlint-disable-next-line oxc/no-async-await -- Await replay completion to verify native snapshot getter order against reducer initialization.
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

/* oxlint-disable oxc/no-async-await -- Await restoration to check original metadata-to-next-part and first-copy continuations. */
it.each(["next-part", "first-copy"])(
  "reads original stored history before queued %s mutations",
  async (target) => {
    const second = {
      filename: "second.png",
      mediaType: "image/png",
      type: "file",
      url: "data:image/png;base64,AQID",
    };
    const body = new Blob(["abc"], { type: "image/png" });
    /* oxlint-disable typescript/promise-function-async -- Full native metadata fixture callbacks return their original Blob promises; async wrappers would add reaction turns. */
    const metadata: Awaited<ReturnType<typeof getFileMetadata>> = {
      arrayBuffer: () => body.arrayBuffer(),
      blob: () => Promise.resolve(body),
      key: "abcdefghijklmnopqrstuvwx.png",
      name: "first.png",
      get size(): number {
        queueMicrotask(() => {
          if (target === "next-part") {
            second.url = "invalid-after-metadata";
          } else {
            mocks.download.mockRejectedValue(new Error("late download"));
          }
        });
        return body.size;
      },
      stream: () => body.stream(),
      text: () => body.text(),
      type: body.type,
    };
    /* oxlint-enable typescript/promise-function-async */
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
  }
);
/* oxlint-enable oxc/no-async-await */
