import assert from "node:assert/strict";
import { expect, mock, test } from "bun:test";
import { importStoredFile } from "./import";
import { importFileInput, maximumWorkspaceFileBytes } from "./schemas";

const input = { fileId: "abcdefghijklmnopqrstuvwx", name: "budget.xlsx" };
const fixture = (bytes = new Uint8Array([0, 255, 1, 17])) => {
  const writeBinaryFile = mock(async () => {
    await Promise.resolve();
  });
  const getSandbox = mock(
    async () =>
      await Promise.resolve({
        resolvePath: (path: string) => `/workspace/${path}`,
        writeBinaryFile,
      })
  );
  const stat = mock(async () => await Promise.resolve({ size: bytes.length }));
  const read = mock(
    async () =>
      await Promise.resolve({
        type: "application/octet-stream",
        stream: () => new Blob([bytes]).stream(),
      })
  );
  return {
    stat,
    read,
    getSandbox,
    writeBinaryFile,
    signal: new AbortController().signal,
  };
};

test("imports exact binary bytes to distinct paths without mutating the stored file", async () => {
  const dependencies = fixture();
  const first = await importStoredFile(input, dependencies);
  const second = await importStoredFile(input, dependencies);
  expect(first.path).toMatch(/^\/workspace\/import-[\da-f-]+-budget\.xlsx$/u);
  expect(second.path).not.toBe(first.path);
  expect(dependencies.writeBinaryFile).toHaveBeenCalledWith({
    path: first.path,
    content: Buffer.from([0, 255, 1, 17]),
    signal: dependencies.signal,
  });
});

test("rejects large stored metadata and oversized actual bytes before acquiring a sandbox", async () => {
  const metadata = fixture();
  metadata.stat.mockResolvedValue({ size: maximumWorkspaceFileBytes + 1 });
  await assert.rejects(importStoredFile(input, metadata), /32 MiB/u);
  expect(metadata.read).not.toHaveBeenCalled();
  expect(metadata.getSandbox).not.toHaveBeenCalled();
  const actual = fixture(new Uint8Array(maximumWorkspaceFileBytes + 1));
  actual.stat.mockResolvedValue({ size: 1 });
  await assert.rejects(importStoredFile(input, actual), /32 MiB/u);
  expect(actual.getSandbox).not.toHaveBeenCalled();
});

test("cancellation and missing storage never write a workspace file", async () => {
  const aborted = fixture();
  await assert.rejects(
    importStoredFile(input, { ...aborted, signal: AbortSignal.abort() })
  );
  expect(aborted.stat).not.toHaveBeenCalled();
  const missing = fixture();
  missing.read.mockRejectedValue(new Error("File missing"));
  await assert.rejects(importStoredFile(input, missing), /File missing/u);
  expect(missing.getSandbox).not.toHaveBeenCalled();
});

test("import accepts only exact file identities and simple filenames", () => {
  for (const fileId of ["https://example.com/file", "../file", "guessed"]) {
    expect(importFileInput.safeParse({ ...input, fileId }).success).toBe(false);
  }
  for (const name of [
    "../budget.xlsx",
    "/etc/passwd",
    "folder\\file.xlsx",
    "bad\nname",
  ]) {
    expect(importFileInput.safeParse({ ...input, name }).success).toBe(false);
  }
});
