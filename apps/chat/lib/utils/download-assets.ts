import type { FilePart, ImagePart, ModelMessage, TextPart } from "ai";
import { FilesError } from "files-sdk";

import { downloadFile } from "@/lib/file-storage";
import { keyFromFileUrl } from "@/lib/file-url";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
/* oxlint-enable sort-imports */
import { getBaseUrl } from "@/lib/url";

const HTTP_NOT_FOUND = 404;

// Minimal utilities to download assets from URL-based parts and inline them.

interface DownloadResult {
  data: Uint8Array;
  mediaType: string | undefined;
}

type AssetDownloadResult = DownloadResult | null;

type DownloadImplementation = (
  args: ReadonlyNativeSurface<{
    url: URL;
  }>
) => Promise<AssetDownloadResult>;

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve defaultDownload's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable max-statements, no-undefined, typescript/strict-boolean-expressions, unicorn/no-null --
 * max-statements (#512): defaultDownload keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-undefined (#519): defaultDownload uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * typescript/strict-boolean-expressions (#610): defaultDownload intentionally keeps the existing falsy-value behavior of key; response.headers.get("content-type"); distinguishing empty, zero, and absent states requires a domain behavior decision.
 * unicorn/no-null (#570): defaultDownload preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
const defaultDownload = async ({
  url,
}: ReadonlyNativeSurface<{
  url: URL;
}>): Promise<AssetDownloadResult> => {
  const isApplicationUrl = url.origin === new URL(getBaseUrl()).origin;
  const key = isApplicationUrl ? keyFromFileUrl(url.toString()) : null;
  if (key) {
    try {
      const file = await downloadFile(key);
      return {
        data: new Uint8Array(await file.arrayBuffer()),
        mediaType: file.type || undefined,
      };
    } catch (error) {
      if (error instanceof FilesError && error.code === "NotFound") {
        return null;
      }
      throw error;
    }
  }

  const response = await fetch(url);
  if (response.status === HTTP_NOT_FOUND) {
    return null;
  }
  if (!response.ok) {
    throw new Error(
      `Failed to download asset: ${url.toString()} (${response.status})`
    );
  }
  // oxlint-disable-next-line typescript/prefer-nullish-coalescing -- #602: Empty text or a falsy optional value deliberately selects the fallback; nullish coalescing would preserve that empty value.
  const contentType = response.headers.get("content-type") || undefined;
  const arrayBuffer = await response.arrayBuffer();
  return { data: new Uint8Array(arrayBuffer), mediaType: contentType };
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-statements, no-undefined, typescript/strict-boolean-expressions, unicorn/no-null */

/* oxlint-disable typescript/strict-boolean-expressions, unicorn/no-null --
 * typescript/strict-boolean-expressions (#610): toHttpUrl intentionally keeps the existing falsy-value behavior of keyFromFileUrl(value); distinguishing empty, zero, and absent states requires a domain behavior decision.
 * unicorn/no-null (#570): toHttpUrl preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
const toHttpUrl = (value: unknown): URL | null => {
  if (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    value.type === "url" &&
    "url" in value &&
    value.url instanceof URL
  ) {
    return toHttpUrl(value.url);
  }
  if (value instanceof URL) {
    return value.protocol === "http:" || value.protocol === "https:"
      ? value
      : null;
  }
  if (typeof value === "string") {
    try {
      const url = keyFromFileUrl(value)
        ? new URL(value, getBaseUrl())
        : new URL(value);
      return url.protocol === "http:" || url.protocol === "https:" ? url : null;
    } catch {
      return null;
    }
  }
  return null;
};
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve downloadAssetsFromModelMessages's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/strict-boolean-expressions, unicorn/no-null */

/* oxlint-disable max-statements, no-continue, typescript/prefer-readonly-parameter-types --
 * typescript/prefer-readonly-parameter-types (#565): downloadAssetsFromModelMessages accepts messages: ModelMessage[]; url; { url, data }; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * max-statements (#512): downloadAssetsFromModelMessages keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-continue (#515): downloadAssetsFromModelMessages skips inapplicable loop entries explicitly; moving the remaining work into nested branches changes the control-flow boundary.
 */
/**
 * Collects all http(s) URLs from file/image parts in the provided messages and downloads them.
 * @param {ModelMessage[]} messages Model messages whose file/image parts are inspected without changing their content.
 * @param {DownloadImplementation} downloadImplementation URL reader invoked once per unique normalized HTTP(S) asset.
 * @returns {Promise<Record<string, AssetDownloadResult>>} Downloaded binary payloads and media types keyed by normalized URL; absent assets retain null results.
 */
const downloadAssetsFromModelMessages = async (
  messages: ModelMessage[],
  downloadImplementation: DownloadImplementation = defaultDownload
): Promise<Record<string, AssetDownloadResult>> => {
  const urlSet = new Set<string>();

  for (const message of messages) {
    if (typeof message.content === "string") {
      continue;
    }
    for (const part of message.content) {
      if (part.type !== "file" && part.type !== "image") {
        continue;
      }
      const dataOrUrl = part.type === "file" ? part.data : part.image;
      const url = toHttpUrl(dataOrUrl);
      if (url) {
        urlSet.add(url.toString());
      }
    }
  }

  const urls = [...urlSet].map((url) => new URL(url));
  const downloaded = await Promise.all(
    urls.map(async (url: ReadonlyNativeSurface<URL>) => ({
      data: await downloadImplementation({ url }),
      url,
    }))
  );
  return Object.fromEntries(
    downloaded.map(
      ({ url, data }: ReadonlyNativeSurface<(typeof downloaded)[number]>) => [
        url.toString(),
        data,
      ]
    )
  );
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-statements, no-continue, typescript/prefer-readonly-parameter-types */

/* oxlint-disable typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null --
 * typescript/prefer-readonly-parameter-types (#565): mapFilePart accepts part: FilePart; downloaded: Record<string, AssetDownloadResult>; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): mapFilePart intentionally keeps the existing falsy-value behavior of found; distinguishing empty, zero, and absent states requires a domain behavior decision.
 * unicorn/no-null (#570): mapFilePart preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
const mapFilePart = (
  part: FilePart,
  downloaded: Record<string, AssetDownloadResult>
): FilePart | null => {
  const url = toHttpUrl(part.data);
  if (url) {
    const found = downloaded[url.toString()];
    if (found === null) {
      return null;
    }
    if (found) {
      return {
        ...part,
        data: found.data,
        mediaType: part.mediaType ?? found.mediaType,
      };
    }
  }
  return part;
};
/* oxlint-enable typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null */

/* oxlint-disable typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null --
 * typescript/prefer-readonly-parameter-types (#565): mapImagePart accepts part: ImagePart; downloaded: Record<string, AssetDownloadResult>; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): mapImagePart intentionally keeps the existing falsy-value behavior of found; distinguishing empty, zero, and absent states requires a domain behavior decision.
 * unicorn/no-null (#570): mapImagePart preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
const mapImagePart = (
  // oxlint-disable-next-line typescript/no-deprecated -- #583: Asset normalization still accepts legacy image payloads; removing this branch would drop supported conversation attachments.
  part: ImagePart,
  downloaded: Record<string, AssetDownloadResult>
  // oxlint-disable-next-line typescript/no-deprecated -- #583: Asset normalization still accepts legacy image payloads; removing this branch would drop supported conversation attachments.
): ImagePart | null => {
  const url = toHttpUrl(part.image);
  if (url) {
    const found = downloaded[url.toString()];
    if (found === null) {
      return null;
    }
    if (found) {
      return {
        ...part,
        image: found.data,
        mediaType: part.mediaType ?? found.mediaType,
      };
    }
  }
  return part;
};
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve replaceFilePartUrlByBinaryDataInMessages's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null */

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, no-magic-numbers, typescript/prefer-readonly-parameter-types --
 * jsdoc/require-param (#534): replaceFilePartUrlByBinaryDataInMessages's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): replaceFilePartUrlByBinaryDataInMessages's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-lines-per-function (#510): replaceFilePartUrlByBinaryDataInMessages keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): replaceFilePartUrlByBinaryDataInMessages uses 0, -1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/prefer-readonly-parameter-types (#565): replaceFilePartUrlByBinaryDataInMessages accepts messages: ModelMessage[]; part: TextPart | ImagePart | FilePart; message; part; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
/**
 * Inlines any URL-based file/image parts within ModelMessage[] by replacing the URLs
 * with downloaded binary data. This ensures providers receive actual bytes.
 */
const replaceFilePartUrlByBinaryDataInMessages = async (
  messages: ModelMessage[],
  downloadImplementation: DownloadImplementation = defaultDownload
): Promise<ModelMessage[]> => {
  const downloaded = await downloadAssetsFromModelMessages(
    messages,
    downloadImplementation
  );

  const mapPart = (
    // oxlint-disable-next-line typescript/no-deprecated -- #583: Asset normalization still accepts legacy image payloads; removing this branch would drop supported conversation attachments.
    part: TextPart | ImagePart | FilePart
    // oxlint-disable-next-line typescript/no-deprecated -- #583: Asset normalization still accepts legacy image payloads; removing this branch would drop supported conversation attachments.
  ): TextPart | ImagePart | FilePart | null => {
    if (part.type === "file") {
      return mapFilePart(part, downloaded);
    }
    if (part.type === "image") {
      return mapImagePart(part, downloaded);
    }
    // Pass through text, tool, reasoning, and other parts unchanged.
    return part;
  };

  const mappedMessages = messages.map((message) => {
    if (message.role !== "user" || typeof message.content === "string") {
      return message;
    }

    return {
      ...message,
      content: message.content.map(mapPart).filter(
        // oxlint-disable-next-line typescript/no-deprecated -- #583: Asset normalization still accepts legacy image payloads; removing this branch would drop supported conversation attachments.
        (part): part is TextPart | ImagePart | FilePart => part !== null
      ),
    };
  });

  const availableMessages = mappedMessages.filter(
    (message) =>
      !(
        message.role === "user" &&
        Array.isArray(message.content) &&
        message.content.length === 0
      )
  );
  const firstUserIndex = availableMessages.findIndex(
    (message) => message.role === "user"
  );
  if (firstUserIndex === -1) {
    return availableMessages.filter((message) => message.role === "system");
  }

  const leadingSystemMessages = availableMessages
    .slice(0, firstUserIndex)
    .filter((message) => message.role === "system");
  return [...leadingSystemMessages, ...availableMessages.slice(firstUserIndex)];
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, no-magic-numbers, typescript/prefer-readonly-parameter-types */
export { replaceFilePartUrlByBinaryDataInMessages };
export type { DownloadImplementation };
