const FILES_PATH = "/api/files";
const FILE_KEY_PREFIX = `${FILES_PATH}/`;

const STORAGE_KEY = /^[A-Za-z0-9_-]{24}(?:\.[a-z0-9]{1,10})?$/u;
const URL_PARSE_BASE = "http://chatjs.local";

const isFileStorageKey = (value: string): boolean => STORAGE_KEY.test(value);

const createFileUrl = (key: string): string =>
  `${FILES_PATH}/${encodeURIComponent(key)}`;

/* oxlint-disable unicorn/no-null -- keyFromFileUrl publicly returns null for malformed URLs and nonstorage paths; getFileImageProps uses that sentinel to preserve external image handling. */
const keyFromFileUrl = (value: string): string | null => {
  try {
    const url = new URL(value, URL_PARSE_BASE);
    if (!url.pathname.startsWith(FILE_KEY_PREFIX)) {
      return null;
    }
    const key = url.pathname.slice(FILE_KEY_PREFIX.length);
    return isFileStorageKey(key) ? key : null;
  } catch {
    return null;
  }
};
/* oxlint-enable unicorn/no-null */

const getFileImageProps = (
  value: string
): {
  src: string;
  unoptimized: boolean;
} => {
  const key = keyFromFileUrl(value);
  return key === null
    ? { src: value, unoptimized: false }
    : { src: createFileUrl(key), unoptimized: true };
};

/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (createFileUrl, FILES_PATH, getFileImageProps, isFileStorageKey, keyFromFileUrl); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export {
  createFileUrl,
  FILES_PATH,
  getFileImageProps,
  isFileStorageKey,
  keyFromFileUrl,
};
/* oxlint-enable import/no-named-export */
