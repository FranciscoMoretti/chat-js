import { Files } from "files-sdk";
import type { Body, StoredFile, UploadResult } from "files-sdk";
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
// oxlint-disable-next-line no-control-regex -- Filename sanitization deliberately removes ASCII C0 and DEL control characters.
const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/gu;
const FILE_ID_LENGTH = 24;
const INVENTORY_PAGE_SIZE = 100;
const SIGNED_URL_LIFETIME_SECONDS = 300;

/* oxlint-disable init-declarations --
 * init-declarations (#507): files assigns these bindings along its control-flow paths; eager undefined initialization would conflict with no-undefined and obscure definite assignment.
 */
let files: Files | undefined;
/* oxlint-enable init-declarations */

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

/* oxlint-disable max-params, typescript/prefer-readonly-parameter-types --
 * max-params (#511): uploadFileAtKey keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * typescript/prefer-readonly-parameter-types (#565): uploadFileAtKey accepts body: Body; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
/**
 * Upload using a preallocated key recorded by the caller before external storage I/O.
 * @param key - Registered file identity validated before provider access.
 * @param filename - Original filename sanitized for the stored pathname.
 * @param body - Upload content consumed by the storage SDK.
 * @param contentType - Optional MIME override forwarded to storage.
 * @returns Registered identity, provider content type, sanitized pathname and application URL.
 */
const uploadFileAtKey = async (
  key: string,
  filename: string,
  body: Body,
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
/* oxlint-enable max-params, typescript/prefer-readonly-parameter-types */

/* oxlint-disable typescript/prefer-readonly-parameter-types --
 * typescript/prefer-readonly-parameter-types (#565): FileUploader accepts body: Body; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
type FileUploader = (
  filename: string,
  body: Body,
  contentType?: string
) => ReturnType<typeof uploadFileAtKey>;
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable init-declarations -- The first inventory page has no cursor; subsequent pages use the cursor supplied by the preceding response. */
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
    // oxlint-disable-next-line eslint/no-await-in-loop -- Each page requires the preceding cursor.
    const page = await getFiles().list({ cursor, limit: INVENTORY_PAGE_SIZE });
    // oxlint-disable-next-line eslint/no-await-in-loop -- Resolve only the current inventory page.
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
/* oxlint-enable init-declarations */

const listFiles = async (): Promise<{
  files: { pathname: string; uploadedAt: Date; url: string }[];
}> => ({
  files: await Array.fromAsync(iterateStoredFiles()),
});

/* oxlint-disable no-magic-numbers -- Zero in explicit empty-array checks is required by unicorn/explicit-length-check. */
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
/* oxlint-enable no-magic-numbers */

/* oxlint-disable no-undefined -- The SDK receives no options when no byte range was requested, preserving its default download behavior. */
const downloadFile = async (
  key: string,
  range?: { readonly start: number; readonly end?: number }
): Promise<StoredFile> =>
  await getFiles().download(
    await storageKeyForFile(key),
    range ? { range } : undefined
  );
/* oxlint-enable no-undefined */

const getFileMetadata = async (key: string): Promise<StoredFile> =>
  await getFiles().head(await storageKeyForFile(key));

const storageSupportsRange = (): boolean => getFiles().capabilities.rangeRead;

/* oxlint-disable unicorn/no-null --
 * unicorn/no-null (#570): getFileProviderUrl preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
const getFileProviderUrl = async (key: string): Promise<string | null> => {
  const fileService = getFiles();
  if (!fileService.capabilities.signedUrl.supported) {
    return null;
  }
  const value = await fileService.url(await storageKeyForFile(key), {
    expiresIn: SIGNED_URL_LIFETIME_SECONDS,
  });
  const url = new URL(value);
  return url.protocol === "http:" || url.protocol === "https:" ? value : null;
};
/* oxlint-enable unicorn/no-null */

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
