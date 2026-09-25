export const FILES_PATH = "/api/files";

const STORAGE_KEY = /^[A-Za-z0-9_-]{24}(?:\.[a-z0-9]{1,10})?$/u;
const URL_PARSE_BASE = "http://chatjs.local";

export const isFileStorageKey = (value: string): boolean =>
  STORAGE_KEY.test(value);

export const createFileUrl = (key: string): string =>
  `${FILES_PATH}/${encodeURIComponent(key)}`;

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
