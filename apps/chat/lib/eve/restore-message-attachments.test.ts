import { beforeEach, expect, it, vi } from "vitest";

import { restoreMessageAttachments } from "./restore-message-attachments";

const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  conversation: vi.fn(),
  download: vi.fn(),
  messages: [] as {
    id: string;
    role: string;
    parts: {
      type: string;
      mediaType: string;
      url?: string;
      filename?: string;
    }[];
  }[],
  metadata: vi.fn(),
  reserve: vi.fn(),
  snapshot: vi.fn(),
  upload: vi.fn(),
}));
vi.mock("../config", () => ({ config: { attachments: { maxBytes: 10 } } }));
vi.mock("../db/eve-queries", () => ({
  getEveConversation: mocks.conversation,
}));
vi.mock("../db/eve-files", () => ({
  canReadEveFile: mocks.access,
  reserveEveUpload: mocks.reserve,
  writeEveUpload: (
    _owner: string,
    _key: string,
    write: () => Promise<unknown>
  ) => write(),
}));
vi.mock("../file-storage", () => ({
  createFileId: () => "abcdefghijklmnopqrstuvwx.png",
  downloadFile: mocks.download,
  getFileMetadata: mocks.metadata,
  uploadFileAtKey: mocks.upload,
}));
vi.mock("./server", () => ({ assertEveConfigured: vi.fn() }));
vi.mock("./connection-options", () => ({
  getEveConnectionOptions: () => ({}),
}));
vi.mock("eve/client", () => ({
  Client: class {
    public sessions = { attach: () => ({ snapshot: mocks.snapshot }) };
  },
  defaultMessageReducer: () => ({
    initial: () => ({ messages: mocks.messages }),
    reduce: vi.fn(),
  }),
}));
const input = { conversationId: "conversation", messageId: "message" };
beforeEach(() => {
  vi.clearAllMocks();
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
  expect(attachments).toEqual([
    expect.objectContaining({
      contentType: "image/png",
      // oxlint-disable-next-line typescript/no-unsafe-assignment -- #595: This restore-message-attachments fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
      digest: expect.stringMatching(/^[a-f0-9]{64}$/u),
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
  const part = mocks.messages[0]?.parts[0];
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
