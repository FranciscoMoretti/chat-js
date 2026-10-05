/* oxlint-disable import/no-nodejs-modules --
 * import/no-nodejs-modules (#529): This test harness requires import assert from "node:assert/strict";; its Node runtime boundary deliberately permits these built-ins.
 */
import assert from "node:assert/strict";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { describe, it, vi } from "vitest";
/* oxlint-enable sort-imports */

import { fileIdsForStorageKeys } from "./db/file-storage-keys";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  createFileId,
  deleteFilesByUrls,
  listFiles,
  uploadFileAtKey,
} from "./file-storage";
/* oxlint-enable sort-imports */
import { keyFromFileUrl } from "./file-url";
/* oxlint-enable import/no-nodejs-modules */

vi.mock("@/lib/config", () => ({
  config: { appPrefix: "storage-test" },
}));

/* oxlint-disable typescript/explicit-function-return-type --
 * typescript/explicit-function-return-type (#560): Keep vi.mock("./storage-provider")'s return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 */
vi.mock("./storage-provider", async () => {
  const { memory } = await import("files-sdk/memory");
  return {
    createStorageAdapter: () => memory(),
  };
});
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions --
 * max-lines-per-function (#510): describe("file storage") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): describe("file storage") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): describe("file storage") uses 0, 100, 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/prefer-readonly-parameter-types (#565): describe("file storage") accepts file; [keys]; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): describe("file storage") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 * typescript/strict-boolean-expressions (#610): describe("file storage") intentionally keeps the existing falsy-value behavior of key; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
describe("file storage", () => {
  it("uploads, lists, and deletes through Files SDK", async () => {
    const uploaded = await uploadFileAtKey(
      createFileId(),
      "../hello.txt",
      "hello",
      "text/plain"
    );
    const key = keyFromFileUrl(uploaded.url);

    assert.ok(key);
    assert.equal(uploaded.pathname, "hello.txt");
    assert.equal(uploaded.contentType, "text/plain");
    assert.equal(uploaded.url, `/api/files/${key}`);
    const uploadedFiles = await listFiles();
    assert.deepEqual(
      uploadedFiles.files.map((file) => file.pathname),
      [key]
    );

    const previousDeploymentUrl = new URL(
      uploaded.url,
      "https://old-chat.example"
    ).toString();
    await deleteFilesByUrls([previousDeploymentUrl]);
    const remainingFiles = await listFiles();
    assert.equal(remainingFiles.files.length, 0);
  });
  it("lists across page boundaries with one mapping query per page", async () => {
    const uploads = await Promise.all(
      Array.from({ length: 101 }, () =>
        uploadFileAtKey(createFileId(), "file.txt", "content", "text/plain")
      )
    );
    vi.mocked(fileIdsForStorageKeys).mockClear();
    try {
      const { files } = await listFiles();
      assert.deepEqual(
        new Set(files.map((file) => file.url)),
        new Set(uploads.map((file) => file.url))
      );
      assert.deepEqual(
        vi
          .mocked(fileIdsForStorageKeys)
          .mock.calls.map(([keys]) => keys.length),
        [100, 1]
      );
    } finally {
      await deleteFilesByUrls(uploads.map((file) => file.url));
    }
  });
});
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions */

/* oxlint-disable typescript/prefer-readonly-parameter-types, typescript/promise-function-async --
 * typescript/prefer-readonly-parameter-types (#565): vi.mock("./db/file-storage-keys") accepts keys: string[]; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): vi.mock("./db/file-storage-keys") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
vi.mock("./db/file-storage-keys", () => ({
  fileIdsForStorageKeys: vi.fn((keys: string[]) =>
    Promise.resolve(
      new Map(keys.map((key) => [key, key.slice("objects/".length)]))
    )
  ),
  storageKeyForFile: (id: string): Promise<string> =>
    Promise.resolve(`objects/${id}`),
}));
/* oxlint-enable typescript/prefer-readonly-parameter-types, typescript/promise-function-async */
