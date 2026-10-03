/* oxlint-disable import/no-nodejs-modules, sort-imports --
 * import/no-nodejs-modules (#529): This test harness requires import assert from "node:assert/strict";; its Node runtime boundary deliberately permits these built-ins.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import assert from "node:assert/strict";

import type { ModelMessage } from "ai";
import { FilesError } from "files-sdk";
import { afterEach, describe, it, vi } from "vitest";

import { replaceFilePartUrlByBinaryDataInMessages } from "./download-assets";
/* oxlint-enable import/no-nodejs-modules, sort-imports */

const { downloadFile } = vi.hoisted(() => ({
  downloadFile: vi.fn(),
}));

vi.mock("@/lib/url", () => ({
  getBaseUrl: (): string => "https://chat.example",
}));

vi.mock("@/lib/file-storage", () => ({ downloadFile }));

/* oxlint-disable init-declarations, max-lines-per-function, max-statements, no-magic-numbers, oxc/no-async-await, oxc/no-optional-chaining, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions, unicorn/no-null --
 * init-declarations (#507): describe("replaceFilePartUrlByBinaryDataInMessages") assigns these bindings along its control-flow paths; eager undefined initialization would conflict with no-undefined and obscure definite assignment.
 * max-lines-per-function (#510): describe("replaceFilePartUrlByBinaryDataInMessages") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): describe("replaceFilePartUrlByBinaryDataInMessages") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): describe("replaceFilePartUrlByBinaryDataInMessages") uses 1, 2, 0, 7, 3, 4, 5, 6 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): describe("replaceFilePartUrlByBinaryDataInMessages") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * oxc/no-optional-chaining (#542): describe("replaceFilePartUrlByBinaryDataInMessages") handles optional file?.type; downloadedUrl?.toString(); inlineFile?.type without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 * typescript/prefer-readonly-parameter-types (#565): describe("replaceFilePartUrlByBinaryDataInMessages") accepts { url }; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): describe("replaceFilePartUrlByBinaryDataInMessages") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 * typescript/strict-boolean-expressions (#610): describe("replaceFilePartUrlByBinaryDataInMessages") intentionally keeps the existing falsy-value behavior of message; distinguishing empty, zero, and absent states requires a domain behavior decision.
 * unicorn/no-null (#570): describe("replaceFilePartUrlByBinaryDataInMessages") preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
describe("replaceFilePartUrlByBinaryDataInMessages", () => {
  it("preserves SDK 7 inline data and provider references without downloading", async () => {
    const messages: ModelMessage[] = [
      {
        content: [
          {
            data: { openai: "file-123" },
            mediaType: "application/pdf",
            type: "file",
          },
          {
            data: { reference: { openai: "file-456" }, type: "reference" },
            mediaType: "application/pdf",
            type: "file",
          },
          {
            data: { text: "document", type: "text" },
            mediaType: "text/plain",
            type: "file",
          },
          {
            data: { data: new Uint8Array([1, 2]), type: "data" },
            mediaType: "application/pdf",
            type: "file",
          },
        ],
        role: "user",
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
          content: [
            {
              data: { type: "url", url },
              mediaType: "application/pdf",
              type: "file",
            },
          ],
          role: "user",
        },
      ],
      download
    );
    assert.deepEqual(download.mock.calls, [[{ url }]]);
    assert.deepEqual(result, [
      {
        content: [
          {
            data: new Uint8Array([7]),
            mediaType: "application/pdf",
            type: "file",
          },
        ],
        role: "user",
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
        content: [
          {
            data: "/api/files/l_u0a2bkphKLFKsBI4q5Tue9.png",
            mediaType: "image/png",
            type: "file",
          },
        ],
        role: "user",
      },
    ]);

    assert.deepEqual(downloadFile.mock.calls, [
      ["l_u0a2bkphKLFKsBI4q5Tue9.png"],
    ]);
    assert.equal(fetchImplementation.mock.calls.length, 0);
    const [message] = result;
    assert.ok(message && Array.isArray(message.content));
    const [file] = message.content;
    assert.ok(file?.type === "file");
    assert.ok(file.data instanceof Uint8Array);
    assert.deepEqual([...file.data], [1, 2, 3]);
  });

  it("omits unavailable managed files from model messages", async () => {
    downloadFile.mockRejectedValue(
      new FilesError("NotFound", "File does not exist")
    );

    const result = await replaceFilePartUrlByBinaryDataInMessages([
      {
        content: [
          { text: "Describe the earlier context", type: "text" },
          {
            data: "/api/files/l_u0a2bkphKLFKsBI4q5Tue9.png",
            mediaType: "image/png",
            type: "file",
          },
        ],
        role: "user",
      },
    ]);

    assert.deepEqual(result, [
      {
        content: [{ text: "Describe the earlier context", type: "text" }],
        role: "user",
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
        content: [
          { text: "Continue this conversation", type: "text" },
          {
            data: "https://legacy.public.blob.vercel-storage.com/missing.png",
            mediaType: "image/png",
            type: "file",
          },
        ],
        role: "user",
      },
    ]);

    assert.deepEqual(result, [
      {
        content: [{ text: "Continue this conversation", type: "text" }],
        role: "user",
      },
    ]);
  });

  it("omits user messages containing only an unavailable file", async () => {
    downloadFile.mockRejectedValue(
      new FilesError("NotFound", "File does not exist")
    );

    const result = await replaceFilePartUrlByBinaryDataInMessages([
      {
        content: [
          {
            data: "/api/files/l_u0a2bkphKLFKsBI4q5Tue9.png",
            mediaType: "image/png",
            type: "file",
          },
        ],
        role: "user",
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
        content: [
          {
            data: "/api/files/l_u0a2bkphKLFKsBI4q5Tue9.png",
            mediaType: "image/png",
            type: "file",
          },
        ],
        role: "user",
      },
      {
        content: [{ text: "Earlier response", type: "text" }],
        role: "assistant",
      },
      {
        content: [{ text: "Continue this conversation", type: "text" }],
        role: "user",
      },
    ]);

    assert.deepEqual(result, [
      {
        content: [{ text: "Continue this conversation", type: "text" }],
        role: "user",
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
        content: [
          { text: "Continue this conversation", type: "text" },
          {
            image: new URL(
              "https://legacy.public.blob.vercel-storage.com/missing.png"
            ),
            type: "image",
          },
        ],
        role: "user",
      },
    ]);

    assert.deepEqual(result, [
      {
        content: [{ text: "Continue this conversation", type: "text" }],
        role: "user",
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
          content: [
            {
              data: "/api/files/l_u0a2bkphKLFKsBI4q5Tue9.png",
              mediaType: "image/png",
              type: "file",
            },
          ],
          role: "user",
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
          content: [
            {
              data: "https://files.example/unavailable.png",
              mediaType: "image/png",
              type: "file",
            },
          ],
          role: "user",
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
        content: [
          {
            data: "https://files.example/api/files/l_u0a2bkphKLFKsBI4q5Tue9.png",
            mediaType: "image/png",
            type: "file",
          },
        ],
        role: "user",
      },
    ]);

    assert.equal(downloadFile.mock.calls.length, 0);
    assert.deepEqual(fetchImplementation.mock.calls, [
      [new URL("https://files.example/api/files/l_u0a2bkphKLFKsBI4q5Tue9.png")],
    ]);
  });

  it("resolves stable application file paths against the current app URL", async () => {
    const messages: ModelMessage[] = [
      {
        content: [
          {
            data: "/api/files/l_u0a2bkphKLFKsBI4q5Tue9.png",
            mediaType: "image/png",
            type: "file",
          },
          {
            data: "aGVsbG8=",
            mediaType: "text/plain",
            type: "file",
          },
        ],
        role: "user",
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
      "https://chat.example/api/files/l_u0a2bkphKLFKsBI4q5Tue9.png"
    );
    const [message] = result;
    assert.ok(message && Array.isArray(message.content));
    const [file, inlineFile] = message.content;
    assert.ok(file?.type === "file");
    assert.ok(file.data instanceof Uint8Array);
    assert.deepEqual([...file.data], [1, 2, 3]);
    assert.ok(inlineFile?.type === "file");
    assert.equal(inlineFile.data, "aGVsbG8=");
  });
});
/* oxlint-enable init-declarations, max-lines-per-function, max-statements, no-magic-numbers, oxc/no-async-await, oxc/no-optional-chaining, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions, unicorn/no-null */

/* oxlint-disable max-lines -- #509: This download-assets.test.ts module keeps its existing fixture/scenario boundaries; splitting it requires an ownership design. EOF-scoped exception applies only to this file-level line metric. */
