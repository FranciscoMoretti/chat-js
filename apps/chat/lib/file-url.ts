const FILES_PATH = "/api/files";

const STORAGE_KEY = /^[A-Za-z0-9_-]{24}(?:\.[a-z0-9]{1,10})?$/u;
const URL_PARSE_BASE = "http://chatjs.local";

const isFileStorageKey = (value: string): boolean => STORAGE_KEY.test(value);

const createFileUrl = (key: string): string =>
  `${FILES_PATH}/${encodeURIComponent(key)}`;

/* oxlint-disable no-magic-numbers, unicorn/no-null -- no-magic-numbers (#517): keyFromFileUrl uses 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
unicorn/no-null (#570): keyFromFileUrl preserves explicit null in its storage/API state; undefined has different serialization and presence semantics. */
const keyFromFileUrl = (value: string): string | null => {
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
/* oxlint-enable no-magic-numbers, unicorn/no-null */

/* oxlint-disable typescript/strict-boolean-expressions -- typescript/strict-boolean-expressions (#610): getFileImageProps intentionally keeps the existing falsy-value behavior of key; distinguishing empty, zero, and absent states requires a domain behavior decision. */
const getFileImageProps = (
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
/* oxlint-enable typescript/strict-boolean-expressions */
export {
  createFileUrl,
  FILES_PATH,
  getFileImageProps,
  isFileStorageKey,
  keyFromFileUrl,
};
