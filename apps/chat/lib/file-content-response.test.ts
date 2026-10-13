import { createFileId, uploadFileAtKey } from "./file-storage";
import { describe, it, vi } from "vitest";
import assert from "node:assert/strict";
import { createFileContentResponse } from "./file-content-response";
import { keyFromFileUrl } from "./file-url";

vi.mock("@/lib/config", () => ({
  config: { appPrefix: "file-response-test" },
}));

vi.mock("./storage-provider", async () => {
  const { memory } = await import("files-sdk/memory");
  return {
    createStorageAdapter: (): ReturnType<typeof memory> => memory(),
  };
});

describe("file content response", () => {
  it("serves uploaded files when Next Image adds a deployment ID", async () => {
    const uploaded = await uploadFileAtKey(
      createFileId(),
      "hello.txt",
      "hello",
      "text/plain"
    );
    const key = keyFromFileUrl(uploaded.url);
    assert.ok(typeof key === "string" && key !== "");
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
    assert.ok(typeof key === "string" && key !== "");
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
      assert.ok(typeof key === "string" && key !== "");
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
  it("rejects unsatisfiable ranges", async () => {
    const uploaded = await uploadFileAtKey(
      createFileId(),
      "short.txt",
      "hi",
      "text/plain"
    );

    const key = keyFromFileUrl(uploaded.url);
    assert.ok(typeof key === "string" && key !== "");
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

vi.mock("./db/file-storage-keys", () => ({
  // oxlint-disable-next-line typescript/promise-function-async -- This DB fixture maps requested storage keys to IDs for response ownership checks; its Promise-only API and synchronous mapping conflict with eslint/require-await.
  fileIdsForStorageKeys: (
    keys: readonly string[]
  ): Promise<Map<string, string>> =>
    Promise.resolve(
      new Map(keys.map((key) => [key, key.slice("objects/".length)]))
    ),
  // oxlint-disable-next-line typescript/promise-function-async -- This DB fixture derives the requested file storage key; its Promise-only API has no work to await under eslint/require-await.
  storageKeyForFile: (id: string): Promise<string> =>
    Promise.resolve(`objects/${id}`),
}));
