import type { Body, StoredFile, UploadResult } from "files-sdk";
import { createFileUrl, isFileStorageKey, keyFromFileUrl } from "./file-url";
import { FILE_STORAGE_PREFIX } from "./constants";
import { Files } from "files-sdk";
import { nanoid } from "nanoid";

import {
  fileIdsForStorageKeys,
  storageKeyForFile,
} from "./db/file-storage-keys";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { createStorageAdapter } from "./storage-provider";
import { storageOptions } from "./storage-options";

const PATH_SEPARATOR = /[\\/]/u;
// oxlint-disable-next-line no-control-regex -- The upload result's pathname contract removes every ASCII C0 and DEL character while preserving all other filename characters.
const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/gu;
const FILE_ID_LENGTH = 24;
const INVENTORY_PAGE_SIZE = 100;
const SIGNED_URL_LIFETIME_SECONDS = 300;

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
  const basename = filename.split(PATH_SEPARATOR).pop() ?? "";
  const withoutControlCharacters = basename.replace(CONTROL_CHARACTERS, "");
  return withoutControlCharacters.trim() || "file";
};

const createFileId = (): string => nanoid(FILE_ID_LENGTH);

/**
 * Upload using a preallocated key recorded by the caller before external storage I/O.
 * @param {string} key - Registered file identity validated before provider access.
 * @param {string} filename - Original filename sanitized for the stored pathname.
 * @param {Body} body - Upload content consumed by the storage SDK.
 * @param {string | undefined} contentType - Optional MIME override forwarded to storage.
 * @returns {Promise<{ contentType: UploadResult["contentType"]; fileId: string; pathname: string; url: string; }>} Registered identity, provider content type, sanitized pathname and application URL.
 */
const uploadFileAtKey = async (
  key: string,
  filename: string,
  body: ReadonlyNativeSurface<Body>,
  contentType?: string
): Promise<{
  contentType: UploadResult["contentType"];
  fileId: string;
  pathname: string;
  url: string;
}> => {
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

type FileUploader = (
  filename: string,
  body: ReadonlyNativeSurface<Body>,
  contentType?: string
) => ReturnType<typeof uploadFileAtKey>;

/**
 * Resolve one provider page at a time, bounding inventory memory and DB queries.
 * @yields {{ pathname: string; uploadedAt: Date; url: string }} Registered file metadata.
 */
const iterateStoredFiles = async function* iterateStoredFiles(): AsyncGenerator<
  { pathname: string; uploadedAt: Date; url: string },
  void,
  unknown
> {
  let cursor: string | undefined;
  do {
    // oxlint-disable-next-line eslint/no-await-in-loop -- The next inventory page needs this page's cursor; resolve only this page's file-ID mapping before yielding and fetching another page.
    const page = await getFiles().list({ cursor, limit: INVENTORY_PAGE_SIZE });
    // oxlint-disable-next-line eslint/no-await-in-loop -- The next inventory page needs this page's cursor; resolve only this page's file-ID mapping before yielding and fetching another page.
    const ids = await fileIdsForStorageKeys(
      page.items.map((file: { readonly key: string }) => file.key)
    );
    for (const file of page.items) {
      const fileId = ids.get(file.key);
      if (typeof fileId === "string" && fileId !== "") {
        yield {
          pathname: fileId,
          uploadedAt: new Date(file.lastModified ?? Date.now()),
          url: createFileUrl(fileId),
        };
      }
    }
    ({ cursor } = page);
  } while (typeof cursor === "string" && cursor !== "");
};

const listFiles = async (): Promise<{
  files: { pathname: string; uploadedAt: Date; url: string }[];
}> => ({
  files: await Array.fromAsync(iterateStoredFiles()),
});
const deleteFilesByUrls = async (urls: readonly string[]): Promise<void> => {
  const keys = [
    ...new Set(
      urls
        .map((url) => keyFromFileUrl(url))
        .filter((key): key is string => key !== null)
    ),
  ];
  if (keys.length === 0) {
    return;
  }

  const result = await getFiles().delete(
    await Promise.all(keys.map(async (key) => await storageKeyForFile(key)))
  );
  const errors = "errors" in result ? (result.errors ?? []) : [];
  if (errors.length > 0) {
    throw new AggregateError(
      errors.map((failure: { readonly error: unknown }) => failure.error),
      `Failed to delete ${errors.length} stored file(s)`
    );
  }
};

const downloadFile = async (
  key: string,
  range?: { readonly start: number; readonly end?: number }
): Promise<StoredFile> =>
  await getFiles().download(
    await storageKeyForFile(key),
    range ? { range } : undefined
  );

const getFileMetadata = async (key: string): Promise<StoredFile> =>
  await getFiles().head(await storageKeyForFile(key));
const storageSupportsRange = (): boolean => getFiles().capabilities.rangeRead;

const getFileProviderUrl = async (key: string): Promise<string | null> => {
  const fileService = getFiles();
  if (!fileService.capabilities.signedUrl.supported) {
    return null;
  }
  const value = await fileService.url(await storageKeyForFile(key), {
    expiresIn: SIGNED_URL_LIFETIME_SECONDS,
  });
  const url = new URL(value);

  if (url.protocol === "http:" || url.protocol === "https:") {
    return value;
  }
  return null;
};

export {
  createFileId,
  uploadFileAtKey,
  iterateStoredFiles,
  listFiles,
  deleteFilesByUrls,
  downloadFile,
  getFileMetadata,
  storageSupportsRange,
  getFileProviderUrl,
};
export type { FileUploader };
