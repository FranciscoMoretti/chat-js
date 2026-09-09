import { type Body, Files } from "files-sdk";
import { nanoid } from "nanoid";
import { FILE_STORAGE_PREFIX } from "./constants";
import { FILE_CONTENT_PATH, keyFromFileUrl } from "./file-url";
import { storageOptions } from "./storage-options";
import { createStorageAdapter } from "./storage-provider";

const SAFE_EXTENSION = /^\.[a-z0-9]{1,10}$/;
const PATH_SEPARATOR = /[\\/]/;

let files: Files | undefined;

function getFiles(): Files {
  files ??= new Files({
    adapter: createStorageAdapter(storageOptions),
    prefix: FILE_STORAGE_PREFIX,
    retries: 2,
  });
  return files;
}

function sanitizeFilename(filename: string): string {
  const basename = filename.split(PATH_SEPARATOR).at(-1) ?? "";
  const withoutControlCharacters = [...basename]
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code > 31 && code !== 127;
    })
    .join("");
  return withoutControlCharacters.trim() || "file";
}

function createStorageKey(filename: string): string {
  const clean = sanitizeFilename(filename);
  const dot = clean.lastIndexOf(".");
  const candidate = dot > 0 ? clean.slice(dot).toLowerCase() : "";
  const extension = SAFE_EXTENSION.test(candidate) ? candidate : "";
  return `${nanoid(24)}${extension}`;
}

function createFileUrl(key: string): string {
  const search = new URLSearchParams({ key });
  return `${FILE_CONTENT_PATH}?${search}`;
}

export async function uploadFile(
  filename: string,
  body: Body,
  contentType?: string
) {
  const pathname = sanitizeFilename(filename);
  const uploaded = await getFiles().upload(createStorageKey(pathname), body, {
    contentType,
  });

  return {
    contentType: uploaded.contentType,
    pathname,
    url: createFileUrl(uploaded.key),
  };
}

export async function listFiles() {
  const files: Array<{
    pathname: string;
    uploadedAt: Date;
    url: string;
  }> = [];
  for await (const file of getFiles().listAll()) {
    files.push({
      pathname: file.key,
      uploadedAt: new Date(file.lastModified ?? Date.now()),
      url: createFileUrl(file.key),
    });
  }
  return { files };
}

export async function deleteFilesByUrls(urls: string[]): Promise<void> {
  const keys = [
    ...new Set(
      urls.map(keyFromFileUrl).filter((key): key is string => key !== null)
    ),
  ];
  if (keys.length === 0) {
    return;
  }

  const result = await getFiles().delete(keys);
  const errors = "errors" in result ? result.errors : undefined;
  if (errors?.length) {
    throw new AggregateError(
      errors.map(({ error }) => error),
      `Failed to delete ${errors.length} stored file(s)`
    );
  }
}

export function downloadFile(
  key: string,
  range?: { start: number; end?: number }
) {
  return getFiles().download(key, range ? { range } : undefined);
}

export function getFileMetadata(key: string) {
  return getFiles().head(key);
}

export function storageSupportsRange(): boolean {
  return getFiles().capabilities.rangeRead;
}

export async function getFileProviderUrl(key: string): Promise<string | null> {
  const fileService = getFiles();
  if (!fileService.capabilities.signedUrl.supported) {
    return null;
  }
  const value = await fileService.url(key);
  const url = new URL(value);
  return url.protocol === "http:" || url.protocol === "https:" ? value : null;
}
