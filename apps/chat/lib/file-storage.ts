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

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): sanitizeFilename uses -1, 0, 31, 127 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
const sanitizeFilename = (filename: string): string => {
  const basename = filename.split(PATH_SEPARATOR).at(-1) ?? "";
  // oxlint-disable-next-line typescript/no-misused-spread -- #586: This transformation intentionally iterates Unicode code points; changing to graphemes or UTF-16 units would alter its existing text contract.
  const withoutControlCharacters = [...basename]
    .filter((character) => {
      const code = character.codePointAt(0) ?? 0;
      return code > 31 && code !== 127;
    })
    .join("");
  return withoutControlCharacters.trim() || "file";
};
/* oxlint-enable no-magic-numbers */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): createFileId uses 24 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
const createFileId = (): string => nanoid(24);
/* oxlint-enable no-magic-numbers */

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, max-params, typescript/prefer-readonly-parameter-types --
 * jsdoc/require-param (#534): uploadFileAtKey's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): uploadFileAtKey's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-params (#511): uploadFileAtKey keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * typescript/prefer-readonly-parameter-types (#565): uploadFileAtKey accepts body: Body; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
/** Internal preallocated key, recorded by the caller before external storage I/O. */
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
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, max-params, typescript/prefer-readonly-parameter-types */

/* oxlint-disable typescript/prefer-readonly-parameter-types --
 * typescript/prefer-readonly-parameter-types (#565): FileUploader accepts body: Body; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
type FileUploader = (
  filename: string,
  body: Body,
  contentType?: string
) => ReturnType<typeof uploadFileAtKey>;
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable init-declarations, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --
 * init-declarations (#507): iterateStoredFiles assigns these bindings along its control-flow paths; eager undefined initialization would conflict with no-undefined and obscure definite assignment.
 * typescript/prefer-readonly-parameter-types (#565): iterateStoredFiles accepts file; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): iterateStoredFiles intentionally keeps the existing falsy-value behavior of cursor; fileId; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
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
/* oxlint-enable init-declarations, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

const listFiles = async (): Promise<{
  files: { pathname: string; uploadedAt: Date; url: string }[];
}> => ({
  files: await Array.fromAsync(iterateStoredFiles()),
});

/* oxlint-disable no-magic-numbers, no-undefined, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions --
 * no-magic-numbers (#517): deleteFilesByUrls uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * no-undefined (#519): deleteFilesByUrls uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * typescript/prefer-readonly-parameter-types (#565): deleteFilesByUrls receives SDK bulk-error callback records containing mutable FilesError objects; the caller URL list is readonly.
 * typescript/promise-function-async (#606): The storage-key map callback passes each original DB promise into Promise.all; async wrappers would change promise identity and synchronous throw timing.
 * typescript/strict-boolean-expressions (#610): deleteFilesByUrls intentionally keeps the existing falsy-value behavior of errors?.length; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
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
    await Promise.all(keys.map((key) => storageKeyForFile(key)))
  );
  const errors = "errors" in result ? result.errors : undefined;
  if (errors?.length) {
    throw new AggregateError(
      errors.map(({ error }) => error),
      `Failed to delete ${errors.length} stored file(s)`
    );
  }
};
/* oxlint-enable no-magic-numbers, no-undefined, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions */

/* oxlint-disable no-undefined, typescript/prefer-readonly-parameter-types --
 * no-undefined (#519): downloadFile uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * typescript/prefer-readonly-parameter-types (#565): downloadFile accepts range?: { start: number; end?: number }; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
const downloadFile = async (
  key: string,
  range?: { start: number; end?: number }
): Promise<StoredFile> =>
  await getFiles().download(
    await storageKeyForFile(key),
    range ? { range } : undefined
  );
/* oxlint-enable no-undefined, typescript/prefer-readonly-parameter-types */

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
    expiresIn: 300,
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
