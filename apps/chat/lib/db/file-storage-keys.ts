import { eq, inArray } from "drizzle-orm";

import { db } from "./client";
import { eveStoredFile } from "./schema";

/* oxlint-disable import/group-exports, import/no-named-export, jsdoc/require-param, jsdoc/require-returns, oxc/no-async-await, typescript/strict-boolean-expressions --
 * import/group-exports (#523): storageKeyForFile stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named storageKeyForFile API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * jsdoc/require-param (#534): storageKeyForFile's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): storageKeyForFile's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * oxc/no-async-await (#540): storageKeyForFile sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * typescript/strict-boolean-expressions (#610): storageKeyForFile intentionally keeps the existing falsy-value behavior of file; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
/** File references use the stable record key; only storage sees storageKey. */
export const storageKeyForFile = async (fileId: string): Promise<string> => {
  const [file] = await db
    .select({ storageKey: eveStoredFile.storageKey })
    .from(eveStoredFile)
    .where(eq(eveStoredFile.key, fileId));
  if (!file) {
    throw new Error("File is not registered.");
  }
  return file.storageKey;
};
/* oxlint-enable import/group-exports, import/no-named-export, jsdoc/require-param, jsdoc/require-returns, oxc/no-async-await, typescript/strict-boolean-expressions */

/* oxlint-disable import/group-exports, import/no-named-export, no-magic-numbers, oxc/no-async-await, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types --
 * import/group-exports (#523): fileIdsForStorageKeys stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named fileIdsForStorageKeys API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * no-magic-numbers (#517): fileIdsForStorageKeys uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * oxc/no-async-await (#540): fileIdsForStorageKeys sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * typescript/explicit-function-return-type (#560): Keep fileIdsForStorageKeys's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep fileIdsForStorageKeys's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): fileIdsForStorageKeys accepts storageKeys: string[]; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
export const fileIdsForStorageKeys = async (storageKeys: string[]) => {
  if (storageKeys.length === 0) {
    return new Map<string, string>();
  }
  const files = await db
    .select({ fileId: eveStoredFile.key, storageKey: eveStoredFile.storageKey })
    .from(eveStoredFile)
    .where(inArray(eveStoredFile.storageKey, storageKeys));
  return new Map(files.map((file) => [file.storageKey, file.fileId]));
};
/* oxlint-enable import/group-exports, import/no-named-export, no-magic-numbers, oxc/no-async-await, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */
