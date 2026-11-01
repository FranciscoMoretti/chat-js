import {
  downloadFile,
  getFileMetadata,
  getFileProviderUrl,
  storageSupportsRange,
} from "./file-storage";
import { FilesError } from "files-sdk";

import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

const HTTP_OK = 200;
const HTTP_PARTIAL_CONTENT = 206;

const RANGE_HEADER = /^bytes=(?:(?<start>\d+)-(?<end>\d*)|-(?<suffix>\d+))$/u;

const parseSuffixRange = (
  suffix: string,
  size: number
): { end: number; start: number } | null => {
  const length = Number(suffix);
  if (Number.isSafeInteger(length) && length > 0 && size > 0) {
    return { end: size - 1, start: Math.max(size - length, 0) };
  }
  return null;
};

const parseExplicitRange = (
  rangeStart: string | undefined,
  rangeEnd: string | undefined,
  size: number
): { end: number; start: number } | null => {
  const start = Number(rangeStart);
  const requestedEnd =
    typeof rangeEnd === "string" && rangeEnd !== ""
      ? Number(rangeEnd)
      : size - 1;
  const end = Math.min(requestedEnd, size - 1);
  if (
    Number.isSafeInteger(start) &&
    Number.isSafeInteger(end) &&
    start >= 0 &&
    start <= end &&
    start < size
  ) {
    return { end, start };
  }
  return null;
};

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
  return parseExplicitRange(rangeStart, rangeEnd, size);
};

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
    status: range ? HTTP_PARTIAL_CONTENT : HTTP_OK,
  });
};
export const createFileContentResponse = async (
  request: ReadonlyNativeSurface<Request>,
  key: string,
  { allowRedirect = true }: { readonly allowRedirect?: boolean } = {}
): Promise<Response> => {
  try {
    if (allowRedirect) {
      const providerUrl = await getFileProviderUrl(key);
      if (typeof providerUrl === "string" && providerUrl !== "") {
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
