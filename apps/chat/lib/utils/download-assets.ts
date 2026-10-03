import type { FilePart, ImagePart, ModelMessage, TextPart } from "ai";
import { FilesError } from "files-sdk";

import { downloadFile } from "@/lib/file-storage";
import { keyFromFileUrl } from "@/lib/file-url";
import { getBaseUrl } from "@/lib/url";

// Minimal utilities to download assets from URL-based parts and inline them.

interface DownloadResult {
  data: Uint8Array;
  mediaType: string | undefined;
}

type AssetDownloadResult = DownloadResult | null;

/* oxlint-disable import/exports-last, typescript/prefer-readonly-parameter-types  --
 * import/exports-last (#522): DownloadImplementation is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/no-named-export (#527): Preserve the named DownloadImplementation API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * typescript/prefer-readonly-parameter-types (#565): DownloadImplementation accepts args: { url: URL; }; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
export type DownloadImplementation = (args: {
  url: URL;
}) => Promise<AssetDownloadResult>;
/* oxlint-enable import/exports-last, typescript/prefer-readonly-parameter-types */

/* oxlint-disable max-statements, no-magic-numbers, no-undefined, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null  --
 * max-statements (#512): defaultDownload keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): defaultDownload uses 404 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * no-ternary (#518): defaultDownload derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * no-undefined (#519): defaultDownload uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * oxc/no-async-await (#540): defaultDownload sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * typescript/prefer-readonly-parameter-types (#565): defaultDownload accepts { url, }: { url: URL; }; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): defaultDownload intentionally keeps the existing falsy-value behavior of key; response.headers.get("content-type"); distinguishing empty, zero, and absent states requires a domain behavior decision.
 * unicorn/no-null (#570): defaultDownload preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
const defaultDownload = async ({
  url,
}: {
  url: URL;
}): Promise<AssetDownloadResult> => {
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
  if (response.status === 404) {
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
/* oxlint-enable max-statements, no-magic-numbers, no-undefined, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null */

/* oxlint-disable typescript/strict-boolean-expressions, unicorn/no-null  --
 * no-ternary (#518): toHttpUrl derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
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
/* oxlint-enable typescript/strict-boolean-expressions, unicorn/no-null */

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, max-statements, no-continue, typescript/prefer-readonly-parameter-types  --
 * jsdoc/require-param (#534): downloadAssetsFromModelMessages's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): downloadAssetsFromModelMessages's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-statements (#512): downloadAssetsFromModelMessages keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-continue (#515): downloadAssetsFromModelMessages skips inapplicable loop entries explicitly; moving the remaining work into nested branches changes the control-flow boundary.
 * no-ternary (#518): downloadAssetsFromModelMessages derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * oxc/no-async-await (#540): downloadAssetsFromModelMessages sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * typescript/prefer-readonly-parameter-types (#565): downloadAssetsFromModelMessages accepts messages: ModelMessage[]; url; { url, data }; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
/**
 * Collects all http(s) URLs from file/image parts in the provided messages and downloads them.
 * Returns a map keyed by the normalized URL string.
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
    urls.map(async (url) => ({
      data: await downloadImplementation({ url }),
      url,
    }))
  );
  return Object.fromEntries(
    downloaded.map(({ url, data }) => [url.toString(), data])
  );
};
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, max-statements, no-continue, typescript/prefer-readonly-parameter-types */

/* oxlint-disable typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null  --
 * oxc/no-rest-spread-properties (#543): mapFilePart copies or separates ...part while preserving existing object ownership; mutating source objects is not equivalent.
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

/* oxlint-disable typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null  --
 * oxc/no-rest-spread-properties (#543): mapImagePart copies or separates ...part while preserving existing object ownership; mutating source objects is not equivalent.
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
/* oxlint-enable typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null */

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, no-magic-numbers, typescript/prefer-readonly-parameter-types  --
 * import/no-named-export (#527): Preserve the named replaceFilePartUrlByBinaryDataInMessages API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * jsdoc/require-param (#534): replaceFilePartUrlByBinaryDataInMessages's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): replaceFilePartUrlByBinaryDataInMessages's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-lines-per-function (#510): replaceFilePartUrlByBinaryDataInMessages keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): replaceFilePartUrlByBinaryDataInMessages uses 0, -1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * oxc/no-async-await (#540): replaceFilePartUrlByBinaryDataInMessages sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * oxc/no-rest-spread-properties (#543): replaceFilePartUrlByBinaryDataInMessages copies or separates ...message while preserving existing object ownership; mutating source objects is not equivalent.
 * typescript/prefer-readonly-parameter-types (#565): replaceFilePartUrlByBinaryDataInMessages accepts messages: ModelMessage[]; part: TextPart | ImagePart | FilePart; message; part; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
/**
 * Inlines any URL-based file/image parts within ModelMessage[] by replacing the URLs
 * with downloaded binary data. This ensures providers receive actual bytes.
 */
export const replaceFilePartUrlByBinaryDataInMessages = async (
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
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, no-magic-numbers, typescript/prefer-readonly-parameter-types */
