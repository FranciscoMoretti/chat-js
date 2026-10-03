/* oxlint-disable import/exports-last, import/group-exports --
 * import/exports-last (#522): FILES_PATH is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): FILES_PATH stays exported at its declaration so its public contract is visible beside its implementation.
 */
export const FILES_PATH = "/api/files";
/* oxlint-enable import/exports-last, import/group-exports */

const STORAGE_KEY = /^[A-Za-z0-9_-]{24}(?:\.[a-z0-9]{1,10})?$/u;
const URL_PARSE_BASE = "http://chatjs.local";

/* oxlint-disable import/group-exports --
 * import/group-exports (#523): isFileStorageKey stays exported at its declaration so its public contract is visible beside its implementation.
 */
export const isFileStorageKey = (value: string): boolean =>
  STORAGE_KEY.test(value);
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports --
 * import/group-exports (#523): createFileUrl stays exported at its declaration so its public contract is visible beside its implementation.
 */
export const createFileUrl = (key: string): string =>
  `${FILES_PATH}/${encodeURIComponent(key)}`;
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports, no-magic-numbers, unicorn/no-null --
 * import/group-exports (#523): keyFromFileUrl stays exported at its declaration so its public contract is visible beside its implementation.
 * no-magic-numbers (#517): keyFromFileUrl uses 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * unicorn/no-null (#570): keyFromFileUrl preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
export const keyFromFileUrl = (value: string): string | null => {
  try {
    const url = new URL(value, URL_PARSE_BASE);
    if (!url.pathname.startsWith(`${FILES_PATH}/`)) {
      return null;
    }
    const key = url.pathname.slice(FILES_PATH.length + 1);
    return isFileStorageKey(key) ? key : null;
  } catch {
    return null;
  }
};
/* oxlint-enable import/group-exports, no-magic-numbers, unicorn/no-null */

/* oxlint-disable import/group-exports, typescript/strict-boolean-expressions --
 * import/group-exports (#523): getFileImageProps stays exported at its declaration so its public contract is visible beside its implementation.
 * typescript/strict-boolean-expressions (#610): getFileImageProps intentionally keeps the existing falsy-value behavior of key; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
export const getFileImageProps = (
  value: string
): {
  src: string;
  unoptimized: boolean;
} => {
  const key = keyFromFileUrl(value);
  return key
    ? { src: createFileUrl(key), unoptimized: true }
    : { src: value, unoptimized: false };
};
/* oxlint-enable import/group-exports, typescript/strict-boolean-expressions */
