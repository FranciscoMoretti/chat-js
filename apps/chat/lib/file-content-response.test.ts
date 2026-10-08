/* oxlint-disable import/no-nodejs-modules --
 * import/no-nodejs-modules (#529): This test harness requires import assert from "node:assert/strict";; its Node runtime boundary deliberately permits these built-ins.
 */
import assert from "node:assert/strict";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { describe, it, vi } from "vitest";
/* oxlint-enable sort-imports */

import { createFileContentResponse } from "./file-content-response";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { createFileId, uploadFileAtKey } from "./file-storage";
/* oxlint-enable sort-imports */
import { keyFromFileUrl } from "./file-url";
/* oxlint-enable import/no-nodejs-modules */

vi.mock("@/lib/config", () => ({
  config: { appPrefix: "file-response-test" },
}));

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve vi.mock's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable typescript/explicit-function-return-type --
 * typescript/explicit-function-return-type (#560): Keep vi.mock("./storage-provider")'s return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 */
vi.mock("./storage-provider", async () => {
  const { memory } = await import("files-sdk/memory");
  return {
    createStorageAdapter: () => memory(),
  };
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable max-lines-per-function, no-magic-numbers, typescript/strict-boolean-expressions --
 * max-lines-per-function (#510): describe("file content response") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): describe("file content response") uses 200, 206, 416 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/strict-boolean-expressions (#610): describe("file content response") intentionally keeps the existing falsy-value behavior of key; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
describe("file content response", () => {
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
  it("serves uploaded files when Next Image adds a deployment ID", async () => {
    const uploaded = await uploadFileAtKey(
      createFileId(),
      "hello.txt",
      "hello",
      "text/plain"
    );
    const key = keyFromFileUrl(uploaded.url);
    assert.ok(key);
    const url = new URL(uploaded.url, "https://chat.example");
    url.searchParams.set("dpl", "dpl_test");

    const response = await createFileContentResponse(new Request(url), key, {
      allowRedirect: false,
    });

    assert.equal(response.status, 200);
    assert.equal(await response.text(), "hello");
  });
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
  it("serves byte ranges", async () => {
    const uploaded = await uploadFileAtKey(
      createFileId(),
      "hello.txt",
      "hello",
      "text/plain"
    );

    const key = keyFromFileUrl(uploaded.url);
    assert.ok(key);
    const response = await createFileContentResponse(
      new Request(new URL(uploaded.url, "https://chat.example"), {
        headers: { Range: "bytes=1-3" },
      }),
      key
    );
    assert.equal(response.status, 206);
    assert.equal(response.headers.get("content-range"), "bytes 1-3/5");
    assert.equal(await response.text(), "ell");

    const suffixResponse = await createFileContentResponse(
      new Request(new URL(uploaded.url, "https://chat.example"), {
        headers: { Range: "bytes=-2" },
      }),
      key
    );
    assert.equal(suffixResponse.status, 206);
    assert.equal(await suffixResponse.text(), "lo");
  });
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it.each(["bytes=2-", "bytes=2-99"])'s awaited sequencing and rejected-Promise behavior. */
  it.each(["bytes=2-", "bytes=2-99"])(
    "clamps range %s to the stored file",
    async (range) => {
      const uploaded = await uploadFileAtKey(
        createFileId(),
        "hello.txt",
        "hello",
        "text/plain"
      );
      const key = keyFromFileUrl(uploaded.url);
      assert.ok(key);
      const response = await createFileContentResponse(
        new Request(new URL(uploaded.url, "https://chat.example"), {
          headers: { Range: range },
        }),
        key,
        { allowRedirect: false }
      );
      assert.equal(response.status, 206);
      assert.equal(response.headers.get("content-range"), "bytes 2-4/5");
      assert.equal(await response.text(), "llo");
    }
  );
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
  it("rejects unsatisfiable ranges", async () => {
    const uploaded = await uploadFileAtKey(
      createFileId(),
      "short.txt",
      "hi",
      "text/plain"
    );

    const key = keyFromFileUrl(uploaded.url);
    assert.ok(key);
    const response = await createFileContentResponse(
      new Request(new URL(uploaded.url, "https://chat.example"), {
        headers: { Range: "bytes=5-8" },
      }),
      key
    );

    assert.equal(response.status, 416);
    assert.equal(response.headers.get("content-range"), "bytes */2");
  });
  /* oxlint-enable oxc/no-async-await */
});
/* oxlint-enable max-lines-per-function, no-magic-numbers, typescript/strict-boolean-expressions */

/* oxlint-disable typescript/explicit-function-return-type, typescript/promise-function-async --
 * typescript/explicit-function-return-type (#560): Keep vi.mock("./db/file-storage-keys")'s return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 * typescript/promise-function-async (#606): vi.mock("./db/file-storage-keys") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
vi.mock("./db/file-storage-keys", () => ({
  fileIdsForStorageKeys: (keys: readonly string[]) =>
    Promise.resolve(
      new Map(keys.map((key) => [key, key.slice("objects/".length)]))
    ),
  storageKeyForFile: (id: string): Promise<string> =>
    Promise.resolve(`objects/${id}`),
}));
/* oxlint-enable typescript/explicit-function-return-type, typescript/promise-function-async */
