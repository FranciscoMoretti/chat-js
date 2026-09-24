import { Files } from "files-sdk";
import type { Body } from "files-sdk";
import { nanoid } from "nanoid";

import { FILE_STORAGE_PREFIX } from "./constants";
import {
  FILE_CONTENT_PATH,
  isFileStorageKey,
  keyFromFileUrl,
} from "./file-url";
import { storageOptions } from "./storage-options";
import { createStorageAdapter } from "./storage-provider";

const SAFE_EXTENSION = /^\.[a-z0-9]{1,10}$/u;
const PATH_SEPARATOR = /[\\/]/u;

let files: Files | undefined;

const getFiles = (): Files => {
  files ??= new Files({
    adapter: createStorageAdapter(storageOptions),
    prefix: FILE_STORAGE_PREFIX,
    retries: 2,
  });
  return files;
};

const sanitizeFilename = (filename: string): string => {
  const basename = filename.split(PATH_SEPARATOR).at(-1) ?? "";
  const withoutControlCharacters = [...basename]
    .filter((character) => {
      const code = character.codePointAt(0) ?? 0;
      return code > 31 && code !== 127;
    })
    .join("");
  return withoutControlCharacters.trim() || "file";
};

export const createFileStorageKey = (filename: string): string => {
  const clean = sanitizeFilename(filename);
  const dot = clean.lastIndexOf(".");
  const candidate = dot > 0 ? clean.slice(dot).toLowerCase() : "";
  const extension = SAFE_EXTENSION.test(candidate) ? candidate : "";
  return `${nanoid(24)}${extension}`;
};

const createFileUrl = (key: string): string => {
  const search = new URLSearchParams({ key });
  return `${FILE_CONTENT_PATH}?${search}`;
};

/** Internal preallocated key, recorded by the caller before external storage I/O. */
export const uploadFileAtKey = async (
  key: string,
  filename: string,
  body: Body,
  contentType?: string
) => {
  if (!isFileStorageKey(key)) {
    throw new Error("Invalid storage key.");
  }
  const pathname = sanitizeFilename(filename);
  const uploaded = await getFiles().upload(key, body, {
    contentType,
  });

  return {
    contentType: uploaded.contentType,
    pathname,
    url: createFileUrl(uploaded.key),
  };
};

export const uploadFile = (
  filename: string,
  body: Body,
  contentType?: string
) =>
  uploadFileAtKey(createFileStorageKey(filename), filename, body, contentType);

export const listFiles = async () => {
  const storedFiles: {
    pathname: string;
    uploadedAt: Date;
    url: string;
  }[] = [];
  for await (const file of getFiles().listAll()) {
    storedFiles.push({
      pathname: file.key,
      uploadedAt: new Date(file.lastModified ?? Date.now()),
      url: createFileUrl(file.key),
    });
  }
  return { files: storedFiles };
};

/** @yields {{ pathname: string; uploadedAt: Date; url: string }} stored file metadata. */
export const iterateStoredFiles = async function* iterateStoredFiles() {
  for await (const file of getFiles().listAll()) {
    yield {
      pathname: file.key,
      uploadedAt: new Date(file.lastModified ?? Date.now()),
      url: createFileUrl(file.key),
    };
  }
};

export const deleteFilesByUrls = async (urls: string[]): Promise<void> => {
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
};

export const downloadFile = (
  key: string,
  range?: { start: number; end?: number }
) => getFiles().download(key, range ? { range } : undefined);

export const getFileMetadata = (key: string) => getFiles().head(key);

export const storageSupportsRange = (): boolean =>
  getFiles().capabilities.rangeRead;

export const getFileProviderUrl = async (
  key: string
): Promise<string | null> => {
  const fileService = getFiles();
  if (!fileService.capabilities.signedUrl.supported) {
    return null;
  }
  const value = await fileService.url(key);
  const url = new URL(value);
  return url.protocol === "http:" || url.protocol === "https:" ? value : null;
};
