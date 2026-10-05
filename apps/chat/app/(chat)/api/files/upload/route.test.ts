import { beforeEach, expect, test, vi } from "vitest";

import { POST } from "./route";

const mocks = vi.hoisted(() => ({ register: vi.fn(), upload: vi.fn() }));
/* oxlint-disable typescript/explicit-function-return-type -- route.test route: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result. */

vi.mock("next/headers", () => ({ headers: () => new Headers() }));
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable typescript/explicit-function-return-type -- route.test route: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result. */
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: () => ({ user: { id: "owner" } }) } },
}));
/* oxlint-enable typescript/explicit-function-return-type */
vi.mock("@/lib/config", () => ({
  config: {
    attachments: { acceptedTypes: { "image/png": [".png"] }, maxBytes: 10 },
  },
}));
vi.mock("@/lib/env", () => ({
  env: { WORKFLOW_POSTGRES_URL: "postgresql://localhost/fixture" },
}));
/* oxlint-disable typescript/explicit-function-return-type -- route.test route: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result. */

vi.mock("@/lib/db/eve-files", () => ({
  reserveEveUpload: mocks.register,
  writeEveUpload: async (
    _owner: string,
    _key: string,
    write: () => Promise<unknown>
  ) => await write(),
}));
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable typescript/explicit-function-return-type -- route.test route: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result. */
vi.mock("@/lib/file-storage", () => ({
  createFileId: () => "abcdefghijklmnopqrstuvwx.png",
  uploadFileAtKey: mocks.upload,
}));
/* oxlint-enable typescript/explicit-function-return-type */

const key = "abcdefghijklmnopqrstuvwx.png";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.upload.mockResolvedValue({
    contentType: "image/png",
    pathname: "fixture.png",
    url: `/api/files/${key}`,
  });
});

const request = (): Request => {
  const form = new FormData();
  form.append(
    "file",
    new Blob(["fixture"], { type: "image/png" }),
    "fixture.png"
  );
  return new Request("http://localhost/api/files/upload", {
    body: form,
    method: "POST",
  });
};

/* oxlint-disable no-magic-numbers -- route.test route: no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 200);  */
test("records the authenticated owner of a server-created storage key before returning it", async () => {
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect(mocks.register).toHaveBeenCalledWith("owner", key);
  expect(await response.json()).toMatchObject({
    url: `/api/files/${key}`,
  });
});
/* oxlint-enable no-magic-numbers */

/* oxlint-disable no-magic-numbers -- route.test route: no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 500);  */
test("does not return a usable upload when ownership registration fails", async () => {
  mocks.register.mockRejectedValue(new Error("database unavailable"));
  const response = await POST(request());
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({ error: "Upload failed" });
  expect(mocks.upload).not.toHaveBeenCalled();
});
/* oxlint-enable no-magic-numbers */

/* oxlint-disable no-magic-numbers, no-undefined, typescript/promise-function-async -- route.test route: no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 200); no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; typescript/promise-function-async: return the existing promise directly; adding async changes synchronous throw behavior and promise identity. */

test("waits for durable ownership before starting storage I/O", async () => {
  const gate = Promise.withResolvers<undefined>();
  mocks.register.mockImplementation(() => gate.promise);
  const response = POST(request());
  await vi.waitFor(() =>
    expect(mocks.register).toHaveBeenCalledWith("owner", key)
  );
  expect(mocks.upload).not.toHaveBeenCalled();
  gate.resolve(undefined);
  const resolvedResult1 = await response;
  expect(resolvedResult1.status).toBe(200);
  expect(mocks.upload).toHaveBeenCalledWith(
    key,
    "fixture.png",
    expect.any(ArrayBuffer),
    "image/png"
  );
});
/* oxlint-enable no-magic-numbers, no-undefined, typescript/promise-function-async */

/* oxlint-disable no-magic-numbers -- route.test route: no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 500);  */

test("retains the reserved identity after an uncertain storage failure", async () => {
  mocks.upload.mockRejectedValue(new Error("storage response lost"));
  const response = await POST(request());
  expect(response.status).toBe(500);
  expect(mocks.register).toHaveBeenCalledExactlyOnceWith("owner", key);
  expect(mocks.upload).toHaveBeenCalledExactlyOnceWith(
    key,
    "fixture.png",
    expect.any(ArrayBuffer),
    "image/png"
  );
});
/* oxlint-enable no-magic-numbers */

/* oxlint-disable no-magic-numbers -- route.test route: no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 400);  */

test("enforces retained upload type and byte limits before reserving storage", async () => {
  for (const file of [
    new File(["fixture"], "unsupported.txt", { type: "text/plain" }),
    new File(["oversized fixture"], "large.png", { type: "image/png" }),
  ]) {
    const form = new FormData();
    form.append("file", file);
    // oxlint-disable-next-line eslint/no-await-in-loop -- Check each independent rejection before storage admission.
    const response = await POST(
      new Request("http://localhost/api/files/upload", {
        body: form,
        method: "POST",
      })
    );
    expect(response.status).toBe(400);
  }
  expect(mocks.register).not.toHaveBeenCalled();
  expect(mocks.upload).not.toHaveBeenCalled();
});
/* oxlint-enable no-magic-numbers */

/* oxlint-disable no-magic-numbers, no-undefined -- route.test route: no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 400); no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value;  */

test.each([undefined, "not multipart"])(
  "rejects malformed upload body %s before storage admission",
  async (body) => {
    const response = await POST(
      new Request("http://localhost/api/files/upload", { body, method: "POST" })
    );
    expect(response.status).toBe(400);
    expect(mocks.register).not.toHaveBeenCalled();
  }
);
/* oxlint-enable no-magic-numbers, no-undefined */

/* oxlint-disable no-magic-numbers -- route.test route: no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 64);  */

test("rejects a declared oversized request without reading its body", async () => {
  const uploadRequest = request();
  uploadRequest.headers.set("content-length", String(64 * 1024 + 11));
  const response = await POST(uploadRequest);
  expect(response.status).toBe(413);
  expect(uploadRequest.bodyUsed).toBe(false);
  expect(mocks.register).not.toHaveBeenCalled();
});
/* oxlint-enable no-magic-numbers */
/* oxlint-disable max-statements, no-magic-numbers, no-undefined, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions -- route.test route: max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 1); no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including controller); typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including contentLength). */

test.each([undefined, "1"])(
  "bounds multipart consumption with content-length %s and cancels the source",
  async (contentLength) => {
    let chunksRead = 0;
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>(
      {
        cancel,
        pull(controller): void {
          chunksRead += 1;
          controller.enqueue(
            chunksRead === 1
              ? new TextEncoder().encode(
                  '--upload\r\nContent-Disposition: form-data; name="file"; filename="large.png"\r\nContent-Type: image/png\r\n\r\n'
                )
              : new Uint8Array(64 * 1024 + 11)
          );
        },
      },
      { highWaterMark: 0 }
    );
    const uploadHeaders = new Headers({
      "content-type": "multipart/form-data; boundary=upload",
    });
    if (contentLength) {
      uploadHeaders.set("content-length", contentLength);
    }
    const init = {
      body,
      duplex: "half",
      headers: uploadHeaders,
      method: "POST",
    };
    const response = await POST(
      new Request("http://localhost/api/files/upload", init)
    );
    expect(response.status).toBe(413);
    expect(chunksRead).toBe(2);
    await vi.waitFor(() => expect(cancel).toHaveBeenCalledOnce());
    expect(mocks.register).not.toHaveBeenCalled();
    expect(mocks.upload).not.toHaveBeenCalled();
  }
);
/* oxlint-enable max-statements, no-magic-numbers, no-undefined, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable no-magic-numbers -- route.test route: no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 200);  */

test("accepts a file at the configured byte limit with multipart overhead", async () => {
  const form = new FormData();
  form.append(
    "file",
    new File(["0123456789"], "limit.png", { type: "image/png" })
  );
  const response = await POST(
    new Request("http://localhost/api/files/upload", {
      body: form,
      method: "POST",
    })
  );
  expect(response.status).toBe(200);
});
/* oxlint-enable no-magic-numbers */
