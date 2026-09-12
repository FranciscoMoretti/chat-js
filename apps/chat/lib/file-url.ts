export const FILE_CONTENT_PATH = "/api/files/content";

const STORAGE_KEY = /^[A-Za-z0-9_-]{24}(?:\.[a-z0-9]{1,10})?$/u;
const URL_PARSE_BASE = "http://chatjs.local";

export function isFileStorageKey(value: string): boolean {
  return STORAGE_KEY.test(value);
}

function parseFileUrl(value: string): URL | null {
  try {
    const url = new URL(value, URL_PARSE_BASE);
    const key = url.searchParams.get("key");
    return url.pathname === FILE_CONTENT_PATH &&
      url.searchParams.size === 1 &&
      key &&
      isFileStorageKey(key)
      ? url
      : null;
  } catch {
    return null;
  }
}

export function keyFromFileUrl(value: string): string | null {
  return parseFileUrl(value)?.searchParams.get("key") ?? null;
}

export function getFileImageProps(value: string): {
  src: string;
  unoptimized: boolean;
} {
  const url = parseFileUrl(value);
  return url
    ? { src: `${url.pathname}${url.search}`, unoptimized: true }
    : { src: value, unoptimized: false };
}
