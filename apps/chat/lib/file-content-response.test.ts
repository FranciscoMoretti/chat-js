/* oxlint-disable import/no-nodejs-modules, sort-imports --
 * import/no-nodejs-modules (#529): This test harness requires import assert from "node:assert/strict";; its Node runtime boundary deliberately permits these built-ins.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import assert from "node:assert/strict";

import { describe, it, vi } from "vitest";

import { createFileContentResponse } from "./file-content-response";
import { createFileId, uploadFileAtKey } from "./file-storage";
import { keyFromFileUrl } from "./file-url";
/* oxlint-enable import/no-nodejs-modules, sort-imports */

vi.mock("@/lib/config", () => ({
  config: { appPrefix: "file-response-test" },
}));

/* oxlint-disable oxc/no-async-await, typescript/explicit-function-return-type --
 * oxc/no-async-await (#540): vi.mock("./storage-provider") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * typescript/explicit-function-return-type (#560): Keep vi.mock("./storage-provider")'s return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 */
vi.mock("./storage-provider", async () => {
  const { memory } = await import("files-sdk/memory");
  return {
    createStorageAdapter: () => memory(),
  };
});
/* oxlint-enable oxc/no-async-await, typescript/explicit-function-return-type */

/* oxlint-disable max-lines-per-function, no-magic-numbers, oxc/no-async-await, typescript/strict-boolean-expressions --
 * max-lines-per-function (#510): describe("file content response") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): describe("file content response") uses 200, 206, 416 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): describe("file content response") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * typescript/strict-boolean-expressions (#610): describe("file content response") intentionally keeps the existing falsy-value behavior of key; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
describe("file content response", () => {
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
});
/* oxlint-enable max-lines-per-function, no-magic-numbers, oxc/no-async-await, typescript/strict-boolean-expressions */

/* oxlint-disable typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/promise-function-async --
 * typescript/explicit-function-return-type (#560): Keep vi.mock("./db/file-storage-keys")'s return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): vi.mock("./db/file-storage-keys") accepts keys: string[]; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): vi.mock("./db/file-storage-keys") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
vi.mock("./db/file-storage-keys", () => ({
  fileIdsForStorageKeys: (keys: string[]) =>
    Promise.resolve(
      new Map(keys.map((key) => [key, key.slice("objects/".length)]))
    ),
  storageKeyForFile: (id: string): Promise<string> =>
    Promise.resolve(`objects/${id}`),
}));
/* oxlint-enable typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */
