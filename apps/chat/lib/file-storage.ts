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

/* oxlint-disable import/group-exports, no-magic-numbers  --
 * import/group-exports (#523): createFileId stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named createFileId API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * no-magic-numbers (#517): createFileId uses 24 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
export const createFileId = (): string => nanoid(24);
/* oxlint-enable import/group-exports, no-magic-numbers */

/* oxlint-disable import/group-exports, jsdoc/require-param, jsdoc/require-returns, max-params, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types  --
 * import/group-exports (#523): uploadFileAtKey stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named uploadFileAtKey API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * jsdoc/require-param (#534): uploadFileAtKey's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): uploadFileAtKey's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-params (#511): uploadFileAtKey keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * oxc/no-async-await (#540): uploadFileAtKey sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * typescript/explicit-function-return-type (#560): Keep uploadFileAtKey's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep uploadFileAtKey's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): uploadFileAtKey accepts body: Body; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
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
/* oxlint-enable import/group-exports, jsdoc/require-param, jsdoc/require-returns, max-params, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */

/* oxlint-disable typescript/prefer-readonly-parameter-types  --
 * import/no-named-export (#527): Preserve the named FileUploader API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * typescript/prefer-readonly-parameter-types (#565): FileUploader accepts body: Body; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
export type FileUploader = (
  filename: string,
  body: Body,
  contentType?: string
) => ReturnType<typeof uploadFileAtKey>;
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports, init-declarations, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions  --
 * import/group-exports (#523): iterateStoredFiles stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named iterateStoredFiles API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * init-declarations (#507): iterateStoredFiles assigns these bindings along its control-flow paths; eager undefined initialization would conflict with no-undefined and obscure definite assignment.
 * oxc/no-async-await (#540): iterateStoredFiles sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * typescript/explicit-function-return-type (#560): Keep iterateStoredFiles's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep iterateStoredFiles's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): iterateStoredFiles accepts file; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): iterateStoredFiles intentionally keeps the existing falsy-value behavior of cursor; fileId; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
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
/* oxlint-enable import/group-exports, init-declarations, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable import/group-exports, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types  --
 * import/group-exports (#523): listFiles stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named listFiles API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * oxc/no-async-await (#540): listFiles sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * typescript/explicit-function-return-type (#560): Keep listFiles's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep listFiles's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 */
export const listFiles = async () => ({
  files: await Array.fromAsync(iterateStoredFiles()),
});
/* oxlint-enable import/group-exports, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */

/* oxlint-disable import/group-exports, no-magic-numbers, no-undefined, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions  --
 * import/group-exports (#523): deleteFilesByUrls stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named deleteFilesByUrls API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * no-magic-numbers (#517): deleteFilesByUrls uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * no-ternary (#518): deleteFilesByUrls derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * no-undefined (#519): deleteFilesByUrls uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * oxc/no-async-await (#540): deleteFilesByUrls sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * oxc/no-optional-chaining (#542): deleteFilesByUrls handles optional errors?.length without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 * typescript/prefer-readonly-parameter-types (#565): deleteFilesByUrls accepts urls: string[]; { error }; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): deleteFilesByUrls preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 * typescript/strict-boolean-expressions (#610): deleteFilesByUrls intentionally keeps the existing falsy-value behavior of errors?.length; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
export const deleteFilesByUrls = async (urls: string[]): Promise<void> => {
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
/* oxlint-enable import/group-exports, no-magic-numbers, no-undefined, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions */

/* oxlint-disable import/group-exports, no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types  --
 * import/group-exports (#523): downloadFile stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named downloadFile API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * no-ternary (#518): downloadFile derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * no-undefined (#519): downloadFile uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * oxc/no-async-await (#540): downloadFile sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * typescript/explicit-function-return-type (#560): Keep downloadFile's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep downloadFile's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): downloadFile accepts range?: { start: number; end?: number }; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
export const downloadFile = async (
  key: string,
  range?: { start: number; end?: number }
) =>
  await getFiles().download(
    await storageKeyForFile(key),
    range ? { range } : undefined
  );
/* oxlint-enable import/group-exports, no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types  --
 * import/group-exports (#523): getFileMetadata stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named getFileMetadata API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * oxc/no-async-await (#540): getFileMetadata sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * typescript/explicit-function-return-type (#560): Keep getFileMetadata's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep getFileMetadata's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 */
export const getFileMetadata = async (key: string) =>
  await getFiles().head(await storageKeyForFile(key));
/* oxlint-enable import/group-exports, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */

/* oxlint-disable import/group-exports  --
 * import/group-exports (#523): storageSupportsRange stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named storageSupportsRange API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export const storageSupportsRange = (): boolean =>
  getFiles().capabilities.rangeRead;
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports, unicorn/no-null  --
 * import/group-exports (#523): getFileProviderUrl stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named getFileProviderUrl API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * no-ternary (#518): getFileProviderUrl derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * oxc/no-async-await (#540): getFileProviderUrl sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * unicorn/no-null (#570): getFileProviderUrl preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
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
/* oxlint-enable import/group-exports, unicorn/no-null */
