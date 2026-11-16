import nodePath from "node:path";
import type { SandboxSession } from "eve/sandbox";
import type { FileUploader } from "@/lib/file-storage";
import type { z } from "zod";
import type { publishFileInput } from "./schemas";
import { maximumPublishedFileBytes, publishFileResult } from "./schemas";

// Active browser formats such as HTML and SVG are delivered as downloads.
const mediaTypes: Readonly<Record<string, string>> = {
  ".txt": "text/plain",
  ".md": "text/plain",
  ".csv": "text/csv",
  ".json": "application/json",
  ".pdf": "application/pdf",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".pptx":
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".zip": "application/zip",
};
const shellQuote = (value: string): string =>
  `'${value.replaceAll("'", "'\\''")}'`;
const inWorkspace = (path: string, root: string): boolean =>
  path.startsWith(`${root}/`);

export const publishSandboxFile = async (
  input: z.infer<typeof publishFileInput>,
  {
    sandbox,
    upload,
    signal,
  }: {
    readonly sandbox: Pick<SandboxSession, "resolvePath" | "run" | "readFile">;
    readonly upload: FileUploader;
    readonly signal: AbortSignal;
  }
): Promise<z.infer<typeof publishFileResult>> => {
  signal.throwIfAborted();
  const root = nodePath.posix.normalize(sandbox.resolvePath("."));
  const path = nodePath.posix.normalize(sandbox.resolvePath(input.path));
  if (!inWorkspace(path, root)) {
    throw new Error("Publish a file inside the sandbox workspace.");
  }
  const quoted = shellQuote(path);
  const resolved = await sandbox.run({
    command: `if [ -f ${quoted} ]; then readlink -f -- ${quoted}; fi`,
    signal,
  });
  const realPath = resolved.stdout.replace(/\n$/u, "");
  if (resolved.exitCode !== 0 || !inWorkspace(realPath, root)) {
    throw new Error(
      "The file is missing, is not a regular file, or resolves outside the workspace."
    );
  }
  const stream = await sandbox.readFile({ path: realPath, signal });
  if (!stream) {
    throw new Error("The sandbox file is no longer available.");
  }
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      signal.throwIfAborted();
      // oxlint-disable-next-line eslint/no-await-in-loop -- Read ordered chunks and enforce a limit before storing bytes.
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      size += value.byteLength;
      if (size > maximumPublishedFileBytes) {
        throw new Error("Files must be 32 MiB or smaller.");
      }
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
  signal.throwIfAborted();
  const name = input.name ?? nodePath.posix.basename(path);
  const mediaType =
    mediaTypes[nodePath.posix.extname(name).toLowerCase()] ??
    "application/octet-stream";
  const stored = await upload(name, Buffer.concat(chunks, size), mediaType);
  return publishFileResult.parse({
    fileId: stored.fileId,
    url: stored.url,
    name: stored.pathname,
    mediaType,
    size,
  });
};
