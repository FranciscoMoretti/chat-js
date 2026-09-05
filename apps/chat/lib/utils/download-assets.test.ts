import assert from "node:assert/strict";
import type { ModelMessage } from "ai";
import { FilesError } from "files-sdk";
import { afterEach, describe, it, vi } from "vitest";

const { downloadFile } = vi.hoisted(() => ({
  downloadFile: vi.fn(),
}));

vi.mock("@/lib/url", () => ({
  getBaseUrl: () => "https://chat.example",
}));

vi.mock("@/lib/file-storage", () => ({ downloadFile }));

import { replaceFilePartUrlByBinaryDataInMessages } from "./download-assets";

describe("replaceFilePartUrlByBinaryDataInMessages", () => {
  it("preserves SDK 7 inline data and provider references without downloading", async () => {
    const messages: ModelMessage[] = [
      {
        role: "user",
        content: [
          {
            type: "file",
            mediaType: "application/pdf",
            data: { openai: "file-123" },
          },
          {
            type: "file",
            mediaType: "application/pdf",
            data: { type: "reference", reference: { openai: "file-456" } },
          },
          {
            type: "file",
            mediaType: "text/plain",
            data: { type: "text", text: "document" },
          },
          {
            type: "file",
            mediaType: "application/pdf",
            data: { type: "data", data: new Uint8Array([1, 2]) },
          },
        ],
      },
    ];
    const download = vi.fn();
    assert.deepEqual(
      await replaceFilePartUrlByBinaryDataInMessages(messages, download),
      messages
    );
    assert.equal(download.mock.calls.length, 0);
  });

  it("downloads structured HTTP FileData URLs", async () => {
    const url = new URL("https://files.example/document.pdf");
    const download = vi.fn().mockResolvedValue({
      data: new Uint8Array([7]),
      mediaType: "application/pdf",
    });
    const result = await replaceFilePartUrlByBinaryDataInMessages(
      [
        {
          role: "user",
          content: [
            {
              type: "file",
              mediaType: "application/pdf",
              data: { type: "url", url },
            },
          ],
        },
      ],
      download
    );
    assert.deepEqual(download.mock.calls, [[{ url }]]);
    assert.deepEqual(result, [
      {
        role: "user",
        content: [
          {
            type: "file",
            mediaType: "application/pdf",
            data: new Uint8Array([7]),
          },
        ],
      },
    ]);
  });

  afterEach(() => {
    downloadFile.mockReset();
    vi.unstubAllGlobals();
  });

  it("downloads managed files directly from storage", async () => {
    downloadFile.mockResolvedValue({
      arrayBuffer: () => Promise.resolve(new Uint8Array([1, 2, 3]).buffer),
      type: "image/png",
    });
    const fetchImplementation = vi.fn();
    vi.stubGlobal("fetch", fetchImplementation);

    const result = await replaceFilePartUrlByBinaryDataInMessages([
      {
        role: "user",
        content: [
          {
            type: "file",
            data: "/api/files/content?key=l_u0a2bkphKLFKsBI4q5Tue9.png",
            mediaType: "image/png",
          },
        ],
      },
    ]);

    assert.deepEqual(downloadFile.mock.calls, [
      ["l_u0a2bkphKLFKsBI4q5Tue9.png"],
    ]);
    assert.equal(fetchImplementation.mock.calls.length, 0);
    const message = result[0];
    assert(message && Array.isArray(message.content));
    const file = message.content[0];
    assert(file?.type === "file");
    assert(file.data instanceof Uint8Array);
    assert.deepEqual([...file.data], [1, 2, 3]);
  });

  it("omits unavailable managed files from model messages", async () => {
    downloadFile.mockRejectedValue(
      new FilesError("NotFound", "File does not exist")
    );

    const result = await replaceFilePartUrlByBinaryDataInMessages([
      {
        role: "user",
        content: [
          { type: "text", text: "Describe the earlier context" },
          {
            type: "file",
            data: "/api/files/content?key=l_u0a2bkphKLFKsBI4q5Tue9.png",
            mediaType: "image/png",
          },
        ],
      },
    ]);

    assert.deepEqual(result, [
      {
        role: "user",
        content: [{ type: "text", text: "Describe the earlier context" }],
      },
    ]);
  });

  it("omits unavailable legacy HTTP files from model messages", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(null, { status: 404 })))
    );

    const result = await replaceFilePartUrlByBinaryDataInMessages([
      {
        role: "user",
        content: [
          { type: "text", text: "Continue this conversation" },
          {
            type: "file",
            data: "https://legacy.public.blob.vercel-storage.com/missing.png",
            mediaType: "image/png",
          },
        ],
      },
    ]);

    assert.deepEqual(result, [
      {
        role: "user",
        content: [{ type: "text", text: "Continue this conversation" }],
      },
    ]);
  });

  it("omits user messages containing only an unavailable file", async () => {
    downloadFile.mockRejectedValue(
      new FilesError("NotFound", "File does not exist")
    );

    const result = await replaceFilePartUrlByBinaryDataInMessages([
      {
        role: "user",
        content: [
          {
            type: "file",
            data: "/api/files/content?key=l_u0a2bkphKLFKsBI4q5Tue9.png",
            mediaType: "image/png",
          },
        ],
      },
    ]);

    assert.deepEqual(result, []);
  });

  it("omits assistant messages exposed by an unavailable user turn", async () => {
    downloadFile.mockRejectedValue(
      new FilesError("NotFound", "File does not exist")
    );

    const result = await replaceFilePartUrlByBinaryDataInMessages([
      {
        role: "user",
        content: [
          {
            type: "file",
            data: "/api/files/content?key=l_u0a2bkphKLFKsBI4q5Tue9.png",
            mediaType: "image/png",
          },
        ],
      },
      {
        role: "assistant",
        content: [{ type: "text", text: "Earlier response" }],
      },
      {
        role: "user",
        content: [{ type: "text", text: "Continue this conversation" }],
      },
    ]);

    assert.deepEqual(result, [
      {
        role: "user",
        content: [{ type: "text", text: "Continue this conversation" }],
      },
    ]);
  });

  it("omits unavailable image parts from model messages", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(null, { status: 404 })))
    );

    const result = await replaceFilePartUrlByBinaryDataInMessages([
      {
        role: "user",
        content: [
          { type: "text", text: "Continue this conversation" },
          {
            type: "image",
            image: new URL(
              "https://legacy.public.blob.vercel-storage.com/missing.png"
            ),
          },
        ],
      },
    ]);

    assert.deepEqual(result, [
      {
        role: "user",
        content: [{ type: "text", text: "Continue this conversation" }],
      },
    ]);
  });

  it("preserves provider failures", async () => {
    const providerError = new FilesError(
      "Provider",
      "Storage is temporarily unavailable"
    );
    downloadFile.mockRejectedValue(providerError);

    await assert.rejects(
      replaceFilePartUrlByBinaryDataInMessages([
        {
          role: "user",
          content: [
            {
              type: "file",
              data: "/api/files/content?key=l_u0a2bkphKLFKsBI4q5Tue9.png",
              mediaType: "image/png",
            },
          ],
        },
      ]),
      providerError
    );
  });

  it("preserves non-404 HTTP failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(null, { status: 500 })))
    );

    await assert.rejects(
      replaceFilePartUrlByBinaryDataInMessages([
        {
          role: "user",
          content: [
            {
              type: "file",
              data: "https://files.example/unavailable.png",
              mediaType: "image/png",
            },
          ],
        },
      ]),
      new Error(
        "Failed to download asset: https://files.example/unavailable.png (500)"
      )
    );
  });

  it("downloads managed-looking URLs on other origins over HTTP", async () => {
    const fetchImplementation = vi.fn(() =>
      Promise.resolve(
        new Response(new Uint8Array([4, 5, 6]), {
          headers: { "content-type": "image/png" },
        })
      )
    );
    vi.stubGlobal("fetch", fetchImplementation);

    await replaceFilePartUrlByBinaryDataInMessages([
      {
        role: "user",
        content: [
          {
            type: "file",
            data: "https://files.example/api/files/content?key=l_u0a2bkphKLFKsBI4q5Tue9.png",
            mediaType: "image/png",
          },
        ],
      },
    ]);

    assert.equal(downloadFile.mock.calls.length, 0);
    assert.deepEqual(fetchImplementation.mock.calls, [
      [
        new URL(
          "https://files.example/api/files/content?key=l_u0a2bkphKLFKsBI4q5Tue9.png"
        ),
      ],
    ]);
  });

  it("resolves stable application file paths against the current app URL", async () => {
    const messages: ModelMessage[] = [
      {
        role: "user",
        content: [
          {
            type: "file",
            data: "/api/files/content?key=l_u0a2bkphKLFKsBI4q5Tue9.png",
            mediaType: "image/png",
          },
          {
            type: "file",
            data: "aGVsbG8=",
            mediaType: "text/plain",
          },
        ],
      },
    ];
    let downloadedUrl: URL | undefined;

    const result = await replaceFilePartUrlByBinaryDataInMessages(
      messages,
      ({ url }) => {
        downloadedUrl = url;
        return Promise.resolve({
          data: new Uint8Array([1, 2, 3]),
          mediaType: "image/png",
        });
      }
    );

    assert.equal(
      downloadedUrl?.toString(),
      "https://chat.example/api/files/content?key=l_u0a2bkphKLFKsBI4q5Tue9.png"
    );
    const message = result[0];
    assert(message && Array.isArray(message.content));
    const file = message.content[0];
    assert(file?.type === "file");
    assert(file.data instanceof Uint8Array);
    assert.deepEqual([...file.data], [1, 2, 3]);
    const inlineFile = message.content[1];
    assert(inlineFile?.type === "file");
    assert.equal(inlineFile.data, "aGVsbG8=");
  });
});
