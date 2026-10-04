import { FilesError } from "files-sdk";

import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

import {
  downloadFile,
  getFileMetadata,
  getFileProviderUrl,
  storageSupportsRange,
} from "./file-storage";

const RANGE_HEADER = /^bytes=(?:(?<start>\d+)-(?<end>\d*)|-(?<suffix>\d+))$/u;

/* oxlint-disable no-magic-numbers, typescript/strict-boolean-expressions, unicorn/no-null --
 * no-magic-numbers (#517): parseRange uses 0, 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/strict-boolean-expressions (#610): parseRange intentionally keeps the existing falsy-value behavior of match.groups?.suffix; match.groups?.end; distinguishing empty, zero, and absent states requires a domain behavior decision.
 * unicorn/no-null (#570): parseRange preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
const parseRange = (
  value: string,
  size: number
): { end: number; start: number } | null => {
  const match = RANGE_HEADER.exec(value);
  if (!match) {
    return null;
  }
  if (match.groups?.suffix) {
    const length = Number(match.groups.suffix);
    return Number.isSafeInteger(length) && length > 0 && size > 0
      ? { end: size - 1, start: Math.max(size - length, 0) }
      : null;
  }
  const start = Number(match.groups?.start);
  const requestedEnd = match.groups?.end ? Number(match.groups.end) : size - 1;
  const end = Math.min(requestedEnd, size - 1);
  return Number.isSafeInteger(start) &&
    Number.isSafeInteger(end) &&
    start >= 0 &&
    start <= end &&
    start < size
    ? { end, start }
    : null;
};
/* oxlint-enable no-magic-numbers, typescript/strict-boolean-expressions, unicorn/no-null */

/* oxlint-disable init-declarations, max-lines-per-function, max-statements, no-magic-numbers, no-undefined, typescript/strict-boolean-expressions, unicorn/no-null -- * init-declarations (#507): createFileContentResponse assigns these bindings along its control-flow paths; eager undefined initialization would conflict with no-undefined and obscure definite assignment.
 * max-lines-per-function (#510): createFileContentResponse keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): createFileContentResponse keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): createFileContentResponse uses 206, 200 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * no-undefined (#519): createFileContentResponse uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * typescript/strict-boolean-expressions (#610): createFileContentResponse intentionally keeps the existing falsy-value behavior of providerUrl; rangeHeader; distinguishing empty, zero, and absent states requires a domain behavior decision.
 * unicorn/no-null (#570): createFileContentResponse preserves explicit null in its storage/API state; undefined has different serialization and presence semantics. */
export const createFileContentResponse = async (
  request: ReadonlyNativeSurface<Request>,
  key: string,
  { allowRedirect = true }: { readonly allowRedirect?: boolean } = {}
): Promise<Response> => {
  try {
    const providerUrl = allowRedirect
      ? await getFileProviderUrl(key)
      : undefined;
    if (providerUrl) {
      return new Response(null, {
        headers: {
          "Cache-Control": "private, no-store",
          Location: providerUrl,
        },
        status: 307,
      });
    }

    const rangeHeader = request.headers.get("range");
    const supportsRange = storageSupportsRange();
    let range: { start: number; end: number } | undefined;
    let fullSize: number | undefined;
    if (rangeHeader && supportsRange) {
      const metadata = await getFileMetadata(key);
      fullSize = metadata.size;
      const parsed = parseRange(rangeHeader, fullSize);
      if (!parsed) {
        return new Response(null, {
          headers: { "Content-Range": `bytes */${fullSize}` },
          status: 416,
        });
      }
      range = parsed;
    }

    const file = await downloadFile(key, range);
    const headers = new Headers({
      "Accept-Ranges": supportsRange ? "bytes" : "none",
      "Cache-Control": "private, no-store",
      "Content-Length": String(file.size),
      "Content-Type": file.type || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
    });
    if (range && fullSize !== undefined) {
      headers.set(
        "Content-Range",
        `bytes ${range.start}-${range.end}/${fullSize}`
      );
    }
    return new Response(file.stream(), {
      headers,
      status: range ? 206 : 200,
    });
  } catch (error) {
    if (error instanceof FilesError && error.code === "NotFound") {
      return new Response("File not found", { status: 404 });
    }
    return new Response("File download failed", { status: 500 });
  }
};
/* oxlint-enable init-declarations, max-lines-per-function, max-statements, no-magic-numbers, no-undefined, typescript/strict-boolean-expressions, unicorn/no-null */
