/* oxlint-disable import/no-nodejs-modules --
 * import/no-nodejs-modules (#529): This test harness requires import assert from "node:assert/strict";; its Node runtime boundary deliberately permits these built-ins.
 */
import assert from "node:assert/strict";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { ModelMessage } from "ai";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import { FilesError } from "files-sdk";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { afterEach, describe, it, vi } from "vitest";
/* oxlint-enable sort-imports */

import { replaceFilePartUrlByBinaryDataInMessages } from "./download-assets";
/* oxlint-enable import/no-nodejs-modules */

const { downloadFile } = vi.hoisted(() => ({
  downloadFile: vi.fn(),
}));

vi.mock("@/lib/url", () => ({
  getBaseUrl: (): string => "https://chat.example",
}));

vi.mock("@/lib/file-storage", () => ({ downloadFile }));

/* oxlint-disable init-declarations, max-lines-per-function, max-statements, no-magic-numbers, typescript/promise-function-async, typescript/strict-boolean-expressions, unicorn/no-null --
 * init-declarations (#507): describe("replaceFilePartUrlByBinaryDataInMessages") assigns these bindings along its control-flow paths; eager undefined initialization would conflict with no-undefined and obscure definite assignment.
 * max-lines-per-function (#510): describe("replaceFilePartUrlByBinaryDataInMessages") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): describe("replaceFilePartUrlByBinaryDataInMessages") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): describe("replaceFilePartUrlByBinaryDataInMessages") uses 1, 2, 0, 7, 3, 4, 5, 6 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/promise-function-async (#606): describe("replaceFilePartUrlByBinaryDataInMessages") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 * typescript/strict-boolean-expressions (#610): describe("replaceFilePartUrlByBinaryDataInMessages") intentionally keeps the existing falsy-value behavior of message; distinguishing empty, zero, and absent states requires a domain behavior decision.
 * unicorn/no-null (#570): describe("replaceFilePartUrlByBinaryDataInMessages") preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
describe("replaceFilePartUrlByBinaryDataInMessages", () => {
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
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
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
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
  /* oxlint-enable oxc/no-async-await */
  afterEach(() => {
    downloadFile.mockReset();
    vi.unstubAllGlobals();
  });

  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
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
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading type from file; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
    assert.ok(file?.type === "file");
    assert.ok(file.data instanceof Uint8Array);
    assert.deepEqual([...file.data], [1, 2, 3]);
  });
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
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
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
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
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
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
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
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
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
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
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
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
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
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
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
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
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
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
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading toString from downloadedUrl; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
      downloadedUrl?.toString(),
      "https://chat.example/api/files/l_u0a2bkphKLFKsBI4q5Tue9.png"
    );
    const [message] = result;
    assert.ok(message && Array.isArray(message.content));
    const [file, inlineFile] = message.content;
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading type from file; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
    assert.ok(file?.type === "file");
    assert.ok(file.data instanceof Uint8Array);
    assert.deepEqual([...file.data], [1, 2, 3]);
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading type from inlineFile; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
    assert.ok(inlineFile?.type === "file");
    assert.equal(inlineFile.data, "aGVsbG8=");
  });
  /* oxlint-enable oxc/no-async-await */
});
/* oxlint-enable init-declarations, max-lines-per-function, max-statements, no-magic-numbers, typescript/promise-function-async, typescript/strict-boolean-expressions, unicorn/no-null */

/* oxlint-disable max-lines -- #509: This download-assets.test.ts module keeps its existing fixture/scenario boundaries; splitting it requires an ownership design. EOF-scoped exception applies only to this file-level line metric. */
