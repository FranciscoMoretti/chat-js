import { beforeEach, expect, test, vi } from "vitest";

import { POST } from "./route";

const HTTP_STATUS = {
  badRequest: 400,
  contentTooLarge: 413,
  internalServerError: 500,
  ok: 200,
};

const FIRST_MULTIPART_CHUNK_NUMBER = 1;
const MAX_UPLOAD_KIB = 64;
const BYTES_PER_KIB = 1024;
const MULTIPART_UPLOAD_LIMIT_BYTES = MAX_UPLOAD_KIB * BYTES_PER_KIB;
const MULTIPART_REQUEST_OVERHEAD_BYTES = 11;
const EXPECTED_MULTIPART_CHUNK_COUNT = 2;

const mocks = vi.hoisted(() => ({ register: vi.fn(), upload: vi.fn() }));
vi.mock("next/headers", () => ({ headers: (): Headers => new Headers() }));

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: (): { user: { id: string } } => ({ user: { id: "owner" } }),
    },
  },
}));
vi.mock("@/lib/config", () => ({
  config: {
    attachments: { acceptedTypes: { "image/png": [".png"] }, maxBytes: 10 },
  },
}));
vi.mock("@/lib/env", () => ({
  env: { WORKFLOW_POSTGRES_URL: "postgresql://localhost/fixture" },
}));
vi.mock("@/lib/db/eve-files", () => ({
  reserveEveUpload: mocks.register,
  writeEveUpload: async (
    _owner: string,
    _key: string,
    write: () => Promise<unknown>
  ): Promise<unknown> => await write(),
}));

vi.mock("@/lib/file-storage", () => ({
  createFileId: (): string => "abcdefghijklmnopqrstuvwx.png",
  uploadFileAtKey: mocks.upload,
}));

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

test("records the authenticated owner of a server-created storage key before returning it", async () => {
  const response = await POST(request());
  expect(response.status).toBe(HTTP_STATUS.ok);
  expect(mocks.register).toHaveBeenCalledWith("owner", key);
  expect(await response.json()).toMatchObject({
    url: `/api/files/${key}`,
  });
});

test("does not return a usable upload when ownership registration fails", async () => {
  mocks.register.mockRejectedValue(new Error("database unavailable"));
  const response = await POST(request());
  expect(response.status).toBe(HTTP_STATUS.internalServerError);
  expect(await response.json()).toEqual({ error: "Upload failed" });
  expect(mocks.upload).not.toHaveBeenCalled();
});

test("waits for durable ownership before starting storage I/O", async () => {
  const gate = Promise.withResolvers<undefined>();
  mocks.register.mockReturnValue(gate.promise);
  const response = POST(request());
  await vi.waitFor(() => {
    expect(mocks.register).toHaveBeenCalledWith("owner", key);
  });
  expect(mocks.upload).not.toHaveBeenCalled();
  // oxlint-disable-next-line unicorn/no-useless-undefined -- The Promise<undefined> resolver requires its explicit completion value.
  gate.resolve(undefined);
  const resolvedResult1 = await response;
  expect(resolvedResult1.status).toBe(HTTP_STATUS.ok);
  expect(mocks.upload).toHaveBeenCalledWith(
    key,
    "fixture.png",
    expect.any(ArrayBuffer),
    "image/png"
  );
});

test("retains the reserved identity after an uncertain storage failure", async () => {
  mocks.upload.mockRejectedValue(new Error("storage response lost"));
  const response = await POST(request());
  expect(response.status).toBe(HTTP_STATUS.internalServerError);
  expect(mocks.register).toHaveBeenCalledExactlyOnceWith("owner", key);
  expect(mocks.upload).toHaveBeenCalledExactlyOnceWith(
    key,
    "fixture.png",
    expect.any(ArrayBuffer),
    "image/png"
  );
});

test.each([
  new File(["fixture"], "unsupported.txt", { type: "text/plain" }),
  new File(["oversized fixture"], "large.png", { type: "image/png" }),
])(
  "enforces retained upload type and byte limits before reserving storage: %p",
  async (file) => {
    const form = new FormData();
    form.append("file", file);
    const response = await POST(
      new Request("http://localhost/api/files/upload", {
        body: form,
        method: "POST",
      })
    );
    expect(response.status).toBe(HTTP_STATUS.badRequest);
    expect(mocks.register).not.toHaveBeenCalled();
    expect(mocks.upload).not.toHaveBeenCalled();
  }
);

test.each([undefined, "not multipart"])(
  "rejects malformed upload body %s before storage admission",
  async (body) => {
    const response = await POST(
      new Request("http://localhost/api/files/upload", { body, method: "POST" })
    );
    expect(response.status).toBe(HTTP_STATUS.badRequest);
    expect(mocks.register).not.toHaveBeenCalled();
  }
);

test("rejects a declared oversized request without reading its body", async () => {
  const uploadRequest = request();
  uploadRequest.headers.set(
    "content-length",
    String(MULTIPART_UPLOAD_LIMIT_BYTES + MULTIPART_REQUEST_OVERHEAD_BYTES)
  );
  const response = await POST(uploadRequest);
  expect(response.status).toBe(HTTP_STATUS.contentTooLarge);
  expect(uploadRequest.bodyUsed).toBe(false);
  expect(mocks.register).not.toHaveBeenCalled();
});

test.each([undefined, "1"])(
  "bounds multipart consumption with content-length %s and cancels the source",
  async (contentLength) => {
    let chunksRead = 0;
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>(
      {
        cancel,
        pull(
          controller: Readonly<ReadableStreamDefaultController<Uint8Array>>
        ): void {
          chunksRead += FIRST_MULTIPART_CHUNK_NUMBER;
          controller.enqueue(
            chunksRead === FIRST_MULTIPART_CHUNK_NUMBER
              ? new TextEncoder().encode(
                  '--upload\r\nContent-Disposition: form-data; name="file"; filename="large.png"\r\nContent-Type: image/png\r\n\r\n'
                )
              : new Uint8Array(
                  MULTIPART_UPLOAD_LIMIT_BYTES +
                    MULTIPART_REQUEST_OVERHEAD_BYTES
                )
          );
        },
      },
      { highWaterMark: 0 }
    );
    const uploadHeaders = new Headers({
      "content-type": "multipart/form-data; boundary=upload",
    });
    if (contentLength !== undefined) {
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
    expect(response.status).toBe(HTTP_STATUS.contentTooLarge);
    expect(chunksRead).toBe(EXPECTED_MULTIPART_CHUNK_COUNT);
    await vi.waitFor(() => {
      expect(cancel).toHaveBeenCalledOnce();
    });
    expect(mocks.register).not.toHaveBeenCalled();
    expect(mocks.upload).not.toHaveBeenCalled();
  }
);

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
  expect(response.status).toBe(HTTP_STATUS.ok);
});
