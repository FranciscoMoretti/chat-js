const FILES_PATH = "/api/files";
const FILE_KEY_PREFIX = `${FILES_PATH}/`;

const STORAGE_KEY = /^[A-Za-z0-9_-]{24}(?:\.[a-z0-9]{1,10})?$/u;
const URL_PARSE_BASE = "http://chatjs.local";

const isFileStorageKey = (value: string): boolean => STORAGE_KEY.test(value);

const createFileUrl = (key: string): string =>
  `${FILES_PATH}/${encodeURIComponent(key)}`;

const keyFromFileUrl = (value: string): string | null => {
  try {
    const url = new URL(value, URL_PARSE_BASE);
    if (!url.pathname.startsWith(FILE_KEY_PREFIX)) {
      return null;
    }
    const key = url.pathname.slice(FILE_KEY_PREFIX.length);

    if (isFileStorageKey(key)) {
      return key;
    }
    return null;
  } catch {
    return null;
  }
};

const getFileImageProps = (
  value: string
): {
  src: string;
  unoptimized: boolean;
} => {
  const key = keyFromFileUrl(value);

  if (key === null) {
    return { src: value, unoptimized: false };
  }
  return { src: createFileUrl(key), unoptimized: true };
};

export {
  createFileUrl,
  FILES_PATH,
  getFileImageProps,
  isFileStorageKey,
  keyFromFileUrl,
};
