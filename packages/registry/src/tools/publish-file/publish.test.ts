import { expect, mock, test } from "bun:test";
import assert from "node:assert/strict";
import nodePath from "node:path";
import { publishSandboxFile } from "./publish";
import { maximumPublishedFileBytes } from "./schemas";

const fixture = (
  realPath = "/workspace/report.csv",
  bytes = new TextEncoder().encode("Item,Cost\nDesign,120\n")
) => {
  const cancel = mock(() => {});
  const upload = mock(
    async (name: string, body: unknown, mediaType?: string) => {
      if (!(body instanceof Uint8Array)) {
        throw new Error("Expected snapshot bytes");
      }
      return await Promise.resolve({
        fileId: "file-id",
        pathname: name,
        url: "/api/files/file-id",
        contentType: mediaType ?? "application/octet-stream",
      });
    }
  );
  const run = mock(
    async () =>
      await Promise.resolve({
        exitCode: 0,
        stdout: `${realPath}\n`,
        stderr: "",
      })
  );
  const readFile = mock(
    async () =>
      await Promise.resolve(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(bytes);
            controller.close();
          },
          cancel,
        })
      )
  );
  return {
    sandbox: {
      resolvePath: (path: string) => nodePath.posix.resolve("/workspace", path),
      run,
      readFile,
    },
    upload,
    signal: new AbortController().signal,
    cancel,
  };
};

test("publishes a byte snapshot with a filename and small descriptor", async () => {
  const bytes = new TextEncoder().encode("original");
  const deps = fixture("/workspace/report.csv", bytes);
  const result = await publishSandboxFile(
    { path: "report.csv", name: "budget.csv" },
    deps
  );
  bytes.fill(0);
  expect(result).toEqual({
    fileId: "file-id",
    name: "budget.csv",
    url: "/api/files/file-id",
    mediaType: "text/csv",
    size: 8,
  });
  expect(deps.upload.mock.calls[0]?.[1]).toEqual(Buffer.from("original"));
});

test.each(["../secret.txt", "/tmp/secret.txt", "/workspace-other/secret.txt"])(
  "rejects workspace escape %s before executing",
  async (path) => {
    const deps = fixture();
    await assert.rejects(
      publishSandboxFile({ path }, deps),
      /inside the sandbox workspace/u
    );
    expect(deps.sandbox.run).not.toHaveBeenCalled();
    expect(deps.upload).not.toHaveBeenCalled();
  }
);

test.each(["/tmp/secret.txt", "", "/workspace-other/secret.txt"])(
  "rejects symlink escape or missing file %s",
  async (resolved) => {
    const deps = fixture(resolved);
    await assert.rejects(
      publishSandboxFile({ path: "report.csv" }, deps),
      /missing/u
    );
    expect(deps.sandbox.readFile).not.toHaveBeenCalled();
    expect(deps.upload).not.toHaveBeenCalled();
  }
);

test("bounds bytes before storage and cancels oversized streams", async () => {
  const deps = fixture();
  const cancel = mock(() => {});
  deps.sandbox.readFile.mockImplementation(
    async () =>
      await Promise.resolve(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array(maximumPublishedFileBytes + 1));
          },
          cancel,
        })
      )
  );
  await assert.rejects(
    publishSandboxFile({ path: "report.csv" }, deps),
    /32 MiB/u
  );
  expect(cancel).toHaveBeenCalled();
  expect(deps.upload).not.toHaveBeenCalled();
});

test("does not upload aborted reads or claim a failed upload succeeded", async () => {
  const deps = fixture();
  await assert.rejects(
    publishSandboxFile(
      { path: "report.csv" },
      { ...deps, signal: AbortSignal.abort() }
    )
  );
  expect(deps.upload).not.toHaveBeenCalled();
  deps.upload.mockRejectedValue(new Error("Storage unavailable"));
  await assert.rejects(
    publishSandboxFile({ path: "report.csv" }, deps),
    /Storage unavailable/u
  );
});

test("active browser formats are downloaded as binary", async () => {
  const result = await publishSandboxFile(
    { path: "report.html" },
    fixture("/workspace/report.html")
  );
  expect(result.mediaType).toBe("application/octet-stream");
});
