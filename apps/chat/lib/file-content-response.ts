import { FilesError } from "files-sdk";

import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import {
  downloadFile,
  getFileMetadata,
  getFileProviderUrl,
  storageSupportsRange,
} from "./file-storage";
/* oxlint-enable sort-imports */

const RANGE_HEADER = /^bytes=(?:(?<start>\d+)-(?<end>\d*)|-(?<suffix>\d+))$/u;

/* oxlint-disable no-magic-numbers, unicorn/no-null -- Byte offsets are zero-based and inclusive; null is the existing invalid-range sentinel. */
const parseSuffixRange = (
  suffix: string,
  size: number
): { end: number; start: number } | null => {
  const length = Number(suffix);
  return Number.isSafeInteger(length) && length > 0 && size > 0
    ? { end: size - 1, start: Math.max(size - length, 0) }
    : null;
};
/* oxlint-enable no-magic-numbers, unicorn/no-null */

/* oxlint-disable no-magic-numbers, unicorn/no-null -- Byte offsets are zero-based and inclusive; null is the existing invalid-range sentinel. */
const parseRange = (
  value: string,
  size: number
): { end: number; start: number } | null => {
  const match = RANGE_HEADER.exec(value);
  if (!match) {
    return null;
  }
  const { suffix, start: rangeStart, end: rangeEnd } = match.groups ?? {};
  if (typeof suffix === "string") {
    return parseSuffixRange(suffix, size);
  }
  const start = Number(rangeStart);
  const requestedEnd =
    typeof rangeEnd === "string" && rangeEnd !== ""
      ? Number(rangeEnd)
      : size - 1;
  const end = Math.min(requestedEnd, size - 1);
  return Number.isSafeInteger(start) &&
    Number.isSafeInteger(end) &&
    start >= 0 &&
    start <= end &&
    start < size
    ? { end, start }
    : null;
};
/* oxlint-enable no-magic-numbers, unicorn/no-null */

const resolveRequestRange = async (
  request: ReadonlyNativeSurface<Request>,
  key: string,
  supportsRange: boolean
): Promise<
  | Response
  | {
      readonly range?: { readonly start: number; readonly end: number };
      readonly fullSize?: number;
    }
> => {
  const rangeHeader = request.headers.get("range");
  if (rangeHeader === null || rangeHeader === "" || !supportsRange) {
    return {};
  }
  const metadata = await getFileMetadata(key);
  const range = parseRange(rangeHeader, metadata.size);
  if (range === null) {
    // oxlint-disable-next-line unicorn/no-null -- An unsatisfiable byte range has no response body.
    return new Response(null, {
      headers: { "Content-Range": `bytes */${metadata.size}` },
      status: 416,
    });
  }
  return { fullSize: metadata.size, range };
};

const createDownloadResponse = async (
  key: string,
  supportsRange: boolean,
  {
    range,
    fullSize,
  }: {
    readonly range?: { readonly start: number; readonly end: number };
    readonly fullSize?: number;
  }
): Promise<Response> => {
  const file = await downloadFile(key, range);
  const headers = new Headers({
    "Accept-Ranges": supportsRange ? "bytes" : "none",
    "Cache-Control": "private, no-store",
    "Content-Length": String(file.size),
    "Content-Type": file.type || "application/octet-stream",
    "X-Content-Type-Options": "nosniff",
  });
  if (range && typeof fullSize === "number") {
    headers.set(
      "Content-Range",
      `bytes ${range.start}-${range.end}/${fullSize}`
    );
  }
  return new Response(file.stream(), {
    headers,
    // oxlint-disable-next-line no-magic-numbers -- HTTP distinguishes partial content (206) from a complete download (200).
    status: range ? 206 : 200,
  });
};

// oxlint-disable-next-line max-statements -- Keep redirect selection, range rejection, streaming, and storage-error translation in one ordered request boundary; the range parser and response builder are separate helpers.
export const createFileContentResponse = async (
  request: ReadonlyNativeSurface<Request>,
  key: string,
  { allowRedirect = true }: { readonly allowRedirect?: boolean } = {}
): Promise<Response> => {
  try {
    if (allowRedirect) {
      const providerUrl = await getFileProviderUrl(key);
      if (typeof providerUrl === "string" && providerUrl !== "") {
        // oxlint-disable-next-line unicorn/no-null -- A temporary redirect carries its target in Location and has no response body.
        return new Response(null, {
          headers: {
            "Cache-Control": "private, no-store",
            Location: providerUrl,
          },
          status: 307,
        });
      }
    }

    const supportsRange = storageSupportsRange();
    const rangeResult = await resolveRequestRange(request, key, supportsRange);
    if (rangeResult instanceof Response) {
      return rangeResult;
    }
    return await createDownloadResponse(key, supportsRange, rangeResult);
  } catch (error) {
    if (error instanceof FilesError && error.code === "NotFound") {
      return new Response("File not found", { status: 404 });
    }
    return new Response("File download failed", { status: 500 });
  }
};
