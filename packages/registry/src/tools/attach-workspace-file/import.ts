import { randomUUID } from "node:crypto";
import type { SandboxSession } from "eve/sandbox";
import type { z } from "zod";
import { maximumWorkspaceFileBytes } from "./schemas";
import type { importFileInput } from "./schemas";

/** Copy authorized stored bytes into a fresh native workspace path. */
export const importStoredFile = async (
  input: z.infer<typeof importFileInput>,
  {
    stat,
    read,
    getSandbox,
    signal,
  }: {
    readonly stat: () => Promise<{ readonly size: number }>;
    readonly read: () => Promise<{
      readonly type: string;
      readonly stream: () => ReadableStream<Uint8Array>;
    }>;
    readonly getSandbox: () => PromiseLike<
      Pick<SandboxSession, "resolvePath" | "writeBinaryFile">
    >;
    readonly signal: AbortSignal;
  }
) => {
  signal.throwIfAborted();
  const metadata = await stat();
  if (metadata.size > maximumWorkspaceFileBytes) {
    throw new Error("Files must be 32 MiB or smaller.");
  }
  signal.throwIfAborted();
  const file = await read();
  const reader = file.stream().getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      signal.throwIfAborted();
      // oxlint-disable-next-line eslint/no-await-in-loop -- Bound storage reads before acquiring a sandbox or writing any bytes.
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      size += value.byteLength;
      if (size > maximumWorkspaceFileBytes) {
        throw new Error("Files must be 32 MiB or smaller.");
      }
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
  signal.throwIfAborted();
  const sandbox = await getSandbox();
  // Fresh flat filenames cannot follow user-selected directories or overwrite an earlier import.
  const path = sandbox.resolvePath(`import-${randomUUID()}-${input.name}`);
  await sandbox.writeBinaryFile({
    path,
    content: Buffer.concat(chunks, size),
    signal,
  });
  return {
    fileId: input.fileId,
    path,
    name: input.name,
    mediaType: file.type,
    size,
  };
};
