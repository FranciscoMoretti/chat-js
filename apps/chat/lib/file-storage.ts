import { Files } from "files-sdk";
import type { Body } from "files-sdk";
import { nanoid } from "nanoid";

import { FILE_STORAGE_PREFIX } from "./constants";
import {
  fileIdsForStorageKeys,
  storageKeyForFile,
} from "./db/file-storage-keys";
import { createFileUrl, isFileStorageKey, keyFromFileUrl } from "./file-url";
import { storageOptions } from "./storage-options";
import { createStorageAdapter } from "./storage-provider";

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

export const createFileId = (): string => nanoid(24);

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
  const uploaded = await getFiles().upload(await storageKeyForFile(key), body, {
    contentType,
  });

  return {
    contentType: uploaded.contentType,
    fileId: key,
    pathname,
    url: createFileUrl(key),
  };
};

export type FileUploader = (
  filename: string,
  body: Body,
  contentType?: string
) => ReturnType<typeof uploadFileAtKey>;

/**
 * Resolve one provider page at a time, bounding inventory memory and DB queries.
 * @yields {{ pathname: string; uploadedAt: Date; url: string }} Registered file metadata.
 */
export const iterateStoredFiles = async function* iterateStoredFiles() {
  let cursor: string | undefined;
  do {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Each page requires the preceding cursor.
    const page = await getFiles().list({ cursor, limit: 100 });
    // oxlint-disable-next-line eslint/no-await-in-loop -- Resolve only the current inventory page.
    const ids = await fileIdsForStorageKeys(page.items.map((file) => file.key));
    for (const file of page.items) {
      const fileId = ids.get(file.key);
      if (fileId) {
        yield {
          pathname: fileId,
          uploadedAt: new Date(file.lastModified ?? Date.now()),
          url: createFileUrl(fileId),
        };
      }
    }
    ({ cursor } = page);
  } while (cursor);
};

export const listFiles = async () => ({
  files: await Array.fromAsync(iterateStoredFiles()),
});

export const deleteFilesByUrls = async (urls: string[]): Promise<void> => {
  const keys = [
    ...new Set(
      urls.map(keyFromFileUrl).filter((key): key is string => key !== null)
    ),
  ];
  if (keys.length === 0) {
    return;
  }

  const result = await getFiles().delete(
    await Promise.all(keys.map(storageKeyForFile))
  );
  const errors = "errors" in result ? result.errors : undefined;
  if (errors?.length) {
    throw new AggregateError(
      errors.map(({ error }) => error),
      `Failed to delete ${errors.length} stored file(s)`
    );
  }
};

export const downloadFile = async (
  key: string,
  range?: { start: number; end?: number }
) =>
  getFiles().download(
    await storageKeyForFile(key),
    range ? { range } : undefined
  );

export const getFileMetadata = async (key: string) =>
  getFiles().head(await storageKeyForFile(key));

export const storageSupportsRange = (): boolean =>
  getFiles().capabilities.rangeRead;

export const getFileProviderUrl = async (
  key: string
): Promise<string | null> => {
  const fileService = getFiles();
  if (!fileService.capabilities.signedUrl.supported) {
    return null;
  }
  const value = await fileService.url(await storageKeyForFile(key), {
    expiresIn: 300,
  });
  const url = new URL(value);
  return url.protocol === "http:" || url.protocol === "https:" ? value : null;
};
