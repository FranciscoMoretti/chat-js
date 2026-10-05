/* oxlint-disable import/no-nodejs-modules --
 * import/no-nodejs-modules (#529): This server/tooling module requires import { createHash } from "node:crypto";; its Node runtime boundary deliberately permits these built-ins.
 */
/* oxlint-disable eslint/sort-keys -- Property order is part of persisted EVE request and transcript hashes; keep the original wire representation. */
import { createHash } from "node:crypto";

import type { EveChannelInput } from "eve/channels/eve";
import type { MessageStreamEvent } from "eve/client";
import { z } from "zod";

import {
  createFileUrl,
  FILES_PATH,
  isFileStorageKey,
  keyFromFileUrl,
} from "@/lib/file-url";

import { eveDocumentOperations } from "./document-contracts";
import { eveMessageTool, eveToolMetadata } from "./message-tool-selection";
import type { ReadonlyEveMessagePart } from "./readonly-message-types";
import { sharedEveMessages } from "./shared-messages";
/* oxlint-enable import/no-nodejs-modules */

type Seed = NonNullable<
  Awaited<ReturnType<NonNullable<EveChannelInput["resolveSeed"]>>>
>;
type SeedPart = Seed["messages"][number]["parts"][number];
const INLINE_FILE_ID = /^[a-f0-9]{64}$/u;
const RESOURCE_TOKEN = /[^\s<>()"'`[\]]+/gu;
const SENTENCE_END = /[.,;:!?]+$/u;
const UUID_REFERENCE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/giu;
const COPY_BOUNDARIES = new Set<MessageStreamEvent["type"]>([
  "session.waiting",
  "session.completed",
  "session.failed",
  "turn.started",
  "message.received",
  "step.started",
  "input.requested",
  "authorization.required",
  "history.seeded",
  "history.restored",
]);
const DOCUMENT_TOOLS = new Set([
  ...Object.keys(eveDocumentOperations),
  "readDocument",
  "runCodeDocument",
  "deepResearch",
]);
const DOCUMENT_FIELDS = new Set(["documentId"]);
const REVISION_FIELDS = new Set([
  "revisionId",
  "expectedRevisionId",
  "parentRevisionId",
]);

class EveCopyNotReadyError extends Error {
  public constructor() {
    super("Wait for the shared conversation to finish before saving a copy.");
    this.name = "EveCopyNotReadyError";
  }
}

/* oxlint-disable max-statements, no-magic-numbers --
 * max-statements (#512): completedPart keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): completedPart uses 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
const completedPart = (part: ReadonlyEveMessagePart): SeedPart => {
  if (part.type === "text" || part.type === "reasoning") {
    if (part.state === "streaming") {
      throw new EveCopyNotReadyError();
    }
    return { type: part.type, text: part.text };
  }
  if (part.type === "file") {
    return {
      type: "file",
      url: z.string().min(1).parse(part.url),
      mediaType: part.mediaType,
      filename: part.filename,
      size: part.size,
    };
  }
  if (part.type === "step-start") {
    return { type: "step-start" };
  }
  if (part.type !== "dynamic-tool") {
    throw new EveCopyNotReadyError();
  }
  const base = {
    type: part.type,
    toolName: part.toolName,
    input: z.json().parse(part.input),
  };
  switch (part.state) {
    case "output-available": {
      if (part.partial) {
        throw new EveCopyNotReadyError();
      }
      return {
        ...base,
        state: part.state,
        output: z.json().parse(part.output),
        ...(part.outputType ? { outputType: part.outputType } : {}),
      };
    }
    case "output-error": {
      return { ...base, state: part.state, errorText: part.errorText };
    }
    case "output-denied": {
      return { ...base, state: part.state, reason: part.approval.reason };
    }
    default: {
      throw new EveCopyNotReadyError();
    }
  }
};
/* oxlint-enable max-statements, no-magic-numbers */
/* oxlint-disable max-params, max-statements, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --
 * max-params (#511): visitStrings keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): visitStrings keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * typescript/prefer-readonly-parameter-types (#565): visitStrings accepts seen = new WeakSet<object>(); deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): visitStrings intentionally keeps the existing falsy-value behavior of value; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
const visitStrings = (
  value: unknown,
  rewrite: (text: string, field?: string) => string,
  mutate = false,
  parentField?: string,
  seen = new WeakSet<object>()
): void => {
  if (!value || typeof value !== "object") {
    return;
  }
  if (seen.has(value)) {
    return;
  }
  seen.add(value);
  for (const key of Object.keys(value)) {
    const item: unknown = Reflect.get(value, key);
    if (typeof item === "string") {
      const replacement = rewrite(
        item,
        Array.isArray(value) ? parentField : key
      );
      if (mutate) {
        Reflect.set(value, key, replacement);
      }
    } else {
      visitStrings(item, rewrite, mutate, key, seen);
    }
  }
};
/* oxlint-enable max-params, max-statements, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */
/* oxlint-disable init-declarations, max-statements, typescript/strict-boolean-expressions --
 * init-declarations (#507): transformFileReferences assigns these bindings along its control-flow paths; eager undefined initialization would conflict with no-undefined and obscure definite assignment.
 * max-statements (#512): transformFileReferences keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * typescript/strict-boolean-expressions (#610): transformFileReferences intentionally keeps the existing falsy-value behavior of key; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
const transformFileReferences = (
  text: string,
  replace: (key: string) => string
): string =>
  text.replace(RESOURCE_TOKEN, (token) => {
    const candidate = token.replace(SENTENCE_END, "");
    if (!candidate.includes(FILES_PATH)) {
      return token;
    }
    let url: URL;
    try {
      url = new URL(candidate, "https://chatjs.local");
    } catch {
      return token;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return token;
    }
    const key = keyFromFileUrl(url.href);
    return key ? replace(key) + token.slice(candidate.length) : token;
  });
/* oxlint-enable init-declarations, max-statements, typescript/strict-boolean-expressions */
/* oxlint-disable typescript/strict-boolean-expressions -- moving it below executable initialization can obscure ordering and API ownership.
typescript/strict-boolean-expressions (#610): eveCopyResources intentionally keeps the existing falsy-value behavior of field; distinguishing empty, zero, and absent states requires a domain behavior decision. */
/**
 * Scans copy content before destination keys are reserved.
 * @param value Transcript or authorized document revision content to inspect.
 * @param documentReferences Whether explicit document and revision fields are collected.
 * @returns Sorted unique file keys, document IDs, and revision IDs found in supported references.
 */
const eveCopyResources = (
  value: unknown,
  documentReferences = false
): { fileKeys: string[]; documentIds: string[]; revisionIds: string[] } => {
  const files = new Set<string>();
  const documents = new Set<string>();
  const revisions = new Set<string>();
  visitStrings({ value }, (text, field) => {
    if ((field === "fileId" || field === "fileIds") && isFileStorageKey(text)) {
      files.add(text);
    }
    transformFileReferences(text, (key) => {
      files.add(key);
      return key;
    });
    if (documentReferences && field && DOCUMENT_FIELDS.has(field)) {
      documents.add(z.uuid().parse(text).toLowerCase());
    }
    if (documentReferences && field && REVISION_FIELDS.has(field)) {
      revisions.add(z.uuid().parse(text).toLowerCase());
    }
    return text;
  });
  return {
    fileKeys: [...files].toSorted(),
    documentIds: [...documents].toSorted(),
    revisionIds: [...revisions].toSorted(),
  };
};
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-disable max-statements, no-continue, typescript/prefer-readonly-parameter-types --
 * max-statements (#512): transcriptResources keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-continue (#515): transcriptResources skips inapplicable loop entries explicitly; moving the remaining work into nested branches changes the control-flow boundary.
 * typescript/prefer-readonly-parameter-types (#565): transcriptResources accepts seed: Seed; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
const transcriptResources = (
  seed: Seed
): ReturnType<typeof eveCopyResources> => {
  const resources = eveCopyResources(seed);
  const documents = new Set<string>();
  const revisions = new Set<string>();
  for (const message of seed.messages) {
    for (const part of message.parts) {
      if (
        part.type !== "dynamic-tool" ||
        part.state !== "output-available" ||
        !DOCUMENT_TOOLS.has(part.toolName)
      ) {
        continue;
      }
      const documentResources = eveCopyResources(part, true);
      for (const id of documentResources.documentIds) {
        documents.add(id);
      }
      for (const id of documentResources.revisionIds) {
        revisions.add(id);
      }
    }
  }
  return {
    ...resources,
    documentIds: [...documents].toSorted(),
    revisionIds: [...revisions].toSorted(),
  };
};
/* oxlint-enable max-statements, no-continue, typescript/prefer-readonly-parameter-types */
/* oxlint-disable max-lines-per-function, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions -- moving it below executable initialization can obscure ordering and API ownership.
max-lines-per-function (#510): prepareEveCopyTranscript keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
no-magic-numbers (#517): prepareEveCopyTranscript uses 1, 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
typescript/prefer-readonly-parameter-types (#565): prepareEveCopyTranscript accepts events: readonly MessageStreamEvent[]; event; message; part; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
typescript/strict-boolean-expressions (#610): prepareEveCopyTranscript intentionally keeps the existing falsy-value behavior of message.metadata?.modelId; distinguishing empty, zero, and absent states requires a domain behavior decision. */
/**
 * Prepares a sanitized completed transcript without model calls or storage access.
 * @param events Ordered native events whose latest copy boundary must be waiting or completed.
 * @returns The seed, its sanitized projection hash, and application resources to allocate; incomplete content throws.
 */
const prepareEveCopyTranscript = (
  events: readonly MessageStreamEvent[]
): {
  seed: Seed;
  projectionHash: string;
  resources: ReturnType<typeof transcriptResources>;
} => {
  const boundary = events.findLast((event) => COPY_BOUNDARIES.has(event.type));
  if (
    boundary?.type !== "session.waiting" &&
    boundary?.type !== "session.completed"
  ) {
    throw new EveCopyNotReadyError();
  }
  // oxlint-disable-next-line oxc/no-map-spread -- #541: Build copy seeds without mutating messages or parts from the source transcript.
  const messages: Seed["messages"] = sharedEveMessages(events).map(
    (message) => {
      if (message.role === "user") {
        const selectedTool = eveMessageTool(message);
        return {
          role: "user",
          ...(selectedTool ? { metadata: eveToolMetadata(selectedTool) } : {}),
          parts: message.parts.map((part) => {
            if (part.type === "text") {
              return { type: "text", text: part.text };
            }
            if (part.type === "file") {
              return {
                type: "file",
                url: z.string().min(1).parse(part.url),
                mediaType: part.mediaType,
                filename: part.filename,
                size: part.size,
              };
            }
            throw new Error("Unsupported shared user content.");
          }),
        };
      }
      return {
        role: "assistant",
        ...(message.metadata?.modelId
          ? { modelId: message.metadata.modelId }
          : {}),
        parts: message.parts.map(completedPart),
      };
    }
  );
  if (
    messages.length === 0 ||
    messages.some((message) => message.parts.length === 0)
  ) {
    throw new EveCopyNotReadyError();
  }
  const seed: Seed = { messages };
  return {
    seed,
    // Hash the sanitized projection only: private events and runtime IDs cannot change it.
    projectionHash: createHash("sha256")
      .update(JSON.stringify(seed))
      .digest("hex"),
    resources: transcriptResources(seed),
  };
};
/* oxlint-enable max-lines-per-function, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */
/* oxlint-disable typescript/consistent-type-definitions --
 * typescript/consistent-type-definitions (#559): CopyAllocations preserves its current alias/interface semantics; declaration merging and implicit index-signature assignability differ between those forms.
 */
type CopyAllocations = {
  files: ReadonlyMap<string, string>;
  documents: ReadonlyMap<string, string>;
  revisions: ReadonlyMap<string, string>;
  inlineFiles?: ReadonlyMap<string, string>;
};
/* oxlint-enable typescript/consistent-type-definitions */
/* oxlint-disable id-length, init-declarations, max-lines-per-function, max-statements, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions -- id-length (#506): rewriteEveCopyResources uses T as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
moving it below executable initialization can obscure ordering and API ownership.
init-declarations (#507): rewriteEveCopyResources assigns these bindings along its control-flow paths; eager undefined initialization would conflict with no-undefined and obscure definite assignment.
max-lines-per-function (#510): rewriteEveCopyResources keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
max-statements (#512): rewriteEveCopyResources keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
typescript/prefer-readonly-parameter-types (#565): rewriteEveCopyResources accepts allocations: CopyAllocations; [from, to]; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
typescript/strict-boolean-expressions (#610): rewriteEveCopyResources intentionally keeps the existing falsy-value behavior of fileId; key; field; replacement; distinguishing empty, zero, and absent states requires a domain behavior decision. */
/**
 * Rewrites a cloned value using durable, ownership-checked destination allocations.
 * @param value Transcript or document content whose source references are replaced in a clone.
 * @param allocations Reserved destination files, documents, revisions, and inline attachment keys.
 * @param documentReferences Whether explicit document/revision fields must be rewritten.
 * @returns A clone of the same value shape with validated destination references; missing or conflicting allocations throw.
 */
const rewriteEveCopyResources = <T>(
  value: T,
  allocations: CopyAllocations,
  documentReferences = false
): T => {
  const fileDestinations = new Set<string>();
  for (const [source, destination] of allocations.files) {
    if (
      !(isFileStorageKey(source) && isFileStorageKey(destination)) ||
      allocations.files.has(destination) ||
      fileDestinations.has(destination)
    ) {
      throw new Error("Invalid copied file allocation.");
    }
    fileDestinations.add(destination);
  }
  const sourceIdentities = new Set(
    [...allocations.documents.keys(), ...allocations.revisions.keys()].map(
      (id) => id.toLowerCase()
    )
  );
  const destinationIdentities = new Set<string>();
  for (const map of [allocations.documents, allocations.revisions]) {
    for (const [source, destination] of map) {
      z.uuid().parse(source);
      z.uuid().parse(destination);
      if (
        sourceIdentities.has(destination.toLowerCase()) ||
        destinationIdentities.has(destination.toLowerCase())
      ) {
        throw new Error("A copy needs fresh document identities.");
      }
      destinationIdentities.add(destination.toLowerCase());
    }
  }
  const documents = new Map(
    [...allocations.documents].map(([from, to]) => [
      from.toLowerCase(),
      to.toLowerCase(),
    ])
  );
  const revisions = new Map(
    [...allocations.revisions].map(([from, to]) => [
      from.toLowerCase(),
      to.toLowerCase(),
    ])
  );
  const identities = new Map([...documents, ...revisions]);
  const copied = structuredClone(value);
  // The root wrapper also rewrites plain document content, not just nested objects.
  const root = { value: copied };
  visitStrings(
    root,
    (text, field) => {
      if (
        (field === "fileId" || field === "fileIds") &&
        isFileStorageKey(text)
      ) {
        const fileId = allocations.files.get(text);
        if (!fileId) {
          throw new Error("Missing copied file allocation.");
        }
        return fileId;
      }
      let result = transformFileReferences(text, (source) => {
        const key = allocations.files.get(source);
        if (!key) {
          throw new Error("Missing copied file allocation.");
        }
        return createFileUrl(key);
      });
      let map: ReadonlyMap<string, string> | undefined;
      if (documentReferences && field && DOCUMENT_FIELDS.has(field)) {
        map = documents;
      }
      if (documentReferences && field && REVISION_FIELDS.has(field)) {
        map = revisions;
      }
      if (map) {
        const replacement = map.get(text.toLowerCase());
        if (!replacement) {
          throw new Error("Missing copied document allocation.");
        }
        return replacement;
      }
      // Document assistant actions mention identities inside natural-language messages.
      // Match the original text once so a replacement cannot cascade into another source.
      if (documentReferences) {
        result = result.replace(
          UUID_REFERENCE,
          (identity) => identities.get(identity.toLowerCase()) ?? identity
        );
      }
      return result;
    },
    true
  );
  return root.value;
};
/* oxlint-enable id-length, init-declarations, max-lines-per-function, max-statements, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */
/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): decodeInlineAttachment uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
const decodeInlineAttachment = (
  part: Extract<
    SeedPart,
    {
      type: "file";
    }
  >
): { id: string; mediaType: string; bytes: Buffer<ArrayBuffer> } => {
  const prefix = `data:${part.mediaType};base64,`;
  if (!part.url.startsWith(prefix)) {
    throw new Error("Invalid inline attachment content type.");
  }
  const encoded = part.url.slice(prefix.length);
  const bytes = Buffer.from(encoded, "base64");
  if (bytes.length === 0 || bytes.toString("base64") !== encoded) {
    throw new Error("Invalid inline attachment encoding.");
  }
  return {
    id: createHash("sha256")
      .update(part.mediaType)
      .update("\0")
      .update(bytes)
      .digest("hex"),
    mediaType: part.mediaType,
    bytes,
  };
};
/* oxlint-enable no-magic-numbers */
/* oxlint-disable no-continue, typescript/prefer-readonly-parameter-types -- moving it below executable initialization can obscure ordering and API ownership.
no-continue (#515): eveCopyInlineAttachments skips inapplicable loop entries explicitly; moving the remaining work into nested branches changes the control-flow boundary.
typescript/prefer-readonly-parameter-types (#565): eveCopyInlineAttachments accepts seed: Seed; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
/**
 * Decodes published inline attachments, binding identity to MIME type and exact bytes.
 * @param seed Prepared seed whose file parts may contain base64 data URLs.
 * @returns Unique inline attachments with validated media types, byte buffers, and content-bound IDs.
 */
const eveCopyInlineAttachments = (
  seed: Seed
): { id: string; mediaType: string; bytes: Buffer }[] => {
  const files = new Map<
    string,
    {
      id: string;
      mediaType: string;
      bytes: Buffer;
    }
  >();
  for (const message of seed.messages) {
    for (const part of message.parts) {
      if (part.type !== "file" || !part.url.startsWith("data:")) {
        continue;
      }
      const file = decodeInlineAttachment(part);
      files.set(file.id, file);
    }
  }
  return [...files.values()];
};
/* oxlint-enable no-continue, typescript/prefer-readonly-parameter-types */
/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, no-undefined, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --
 * max-lines-per-function (#510): copyAttachmentResolver keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): copyAttachmentResolver keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): copyAttachmentResolver uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * no-undefined (#519): copyAttachmentResolver uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * typescript/prefer-readonly-parameter-types (#565): copyAttachmentResolver accepts allocations: CopyAllocations; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): copyAttachmentResolver intentionally keeps the existing falsy-value behavior of key; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
const copyAttachmentResolver = (
  allocations: CopyAllocations,
  loadDestinationFile: (key: string) => Promise<Pick<Blob, "type" | "size">>,
  origin: string
): ((part: Extract<SeedPart, { type: "file" }>) => Promise<void>) => {
  const destinationKeys = new Set(allocations.files.values());
  for (const [id, key] of allocations.inlineFiles ?? []) {
    if (
      !(INLINE_FILE_ID.test(id) && isFileStorageKey(key)) ||
      allocations.files.has(key) ||
      destinationKeys.has(key)
    ) {
      throw new Error("Invalid inline attachment allocation.");
    }
    destinationKeys.add(key);
  }
  const metadata = new Map<string, Promise<Pick<Blob, "type" | "size">>>();
  return async (
    part: Extract<
      SeedPart,
      {
        type: "file";
      }
    >
  ): Promise<void> => {
    const inline = part.url.startsWith("data:")
      ? decodeInlineAttachment(part)
      : undefined;
    const key = inline
      ? allocations.inlineFiles?.get(inline.id)
      : keyFromFileUrl(part.url);
    if (!(key && destinationKeys.has(key))) {
      throw new Error("Missing copied attachment allocation.");
    }
    let file = metadata.get(key);
    if (!file) {
      file = loadDestinationFile(key);
      metadata.set(key, file);
    }
    const stored = await file;
    if (
      stored.type !== part.mediaType ||
      !Number.isSafeInteger(stored.size) ||
      stored.size <= 0 ||
      (part.size !== undefined && part.size !== stored.size) ||
      (inline !== undefined && inline.bytes.length !== stored.size)
    ) {
      throw new Error("Copied attachment content metadata changed.");
    }
    part.url = new URL(createFileUrl(key), origin).href;
    part.size = stored.size;
  };
};
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, no-undefined, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */
/* oxlint-disable typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --
 * typescript/prefer-readonly-parameter-types (#565): rewriteDocumentPart accepts part: SeedPart; allocations: CopyAllocations; [from, to]; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): rewriteDocumentPart intentionally keeps the existing falsy-value behavior of field; replacement; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
const rewriteDocumentPart = (
  part: SeedPart,
  allocations: CopyAllocations
): void => {
  const identities = new Map(
    [...allocations.documents, ...allocations.revisions].map(([from, to]) => [
      from.toLowerCase(),
      to.toLowerCase(),
    ])
  );
  const requireAllocation =
    part.type === "dynamic-tool" && part.state === "output-available";
  visitStrings(
    part,
    (text, field) => {
      if (field && (DOCUMENT_FIELDS.has(field) || REVISION_FIELDS.has(field))) {
        const replacement = identities.get(text.toLowerCase());
        if (!replacement && requireAllocation) {
          throw new Error("Missing copied document allocation.");
        }
        return replacement ?? text;
      }
      return text.replace(
        UUID_REFERENCE,
        (id) => identities.get(id.toLowerCase()) ?? id
      );
    },
    true
  );
};
/* oxlint-enable typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */
/* oxlint-disable max-params, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types --max-params (#511): materializeEveCopyTranscript keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
max-statements (#512): materializeEveCopyTranscript keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
no-magic-numbers (#517): materializeEveCopyTranscript uses 8, 1024 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
typescript/prefer-readonly-parameter-types (#565): materializeEveCopyTranscript accepts seed: Seed; allocations: CopyAllocations; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
/**
 * Materializes reserved destination attachments and document references in a copied seed.
 * @param seed Prepared transcript cloned before destination URLs and metadata are written.
 * @param allocations Durable destination allocations validated against source resource identities.
 * @param loadDestinationFile Reads committed destination MIME type and size for receipt checks.
 * @param origin HTTP(S) origin used to construct copied file URLs without credentials.
 * @returns A channel-attachment seed whose metadata matches committed files and fits the copy-size limit.
 */
const materializeEveCopyTranscript = async (
  seed: Seed,
  allocations: CopyAllocations,
  loadDestinationFile: (key: string) => Promise<Pick<Blob, "type" | "size">>,
  origin: string
): Promise<Seed> => {
  const base = new URL(origin);
  if (
    !["http:", "https:"].includes(base.protocol) ||
    base.username ||
    base.password
  ) {
    throw new Error("Invalid copy attachment origin.");
  }
  const copied = rewriteEveCopyResources(seed, allocations);
  copied.attachments = "channel";
  const materializeFile = copyAttachmentResolver(
    allocations,
    loadDestinationFile,
    base.origin
  );
  for (const message of copied.messages) {
    for (const part of message.parts) {
      if (part.type === "file") {
        // oxlint-disable-next-line eslint/no-await-in-loop -- Bound attachment memory and finish each owned write before proceeding.
        await materializeFile(part);
      } else if (
        part.type === "text" ||
        part.type === "reasoning" ||
        (part.type === "dynamic-tool" && DOCUMENT_TOOLS.has(part.toolName))
      ) {
        rewriteDocumentPart(part, allocations);
      }
    }
  }
  if (Buffer.byteLength(JSON.stringify(copied)) > 8 * 1024 * 1024) {
    throw new Error(
      "This conversation exceeds Eve's transcript copy size limit."
    );
  }
  return copied;
};
/* oxlint-enable max-params, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types */

/* oxlint-disable max-lines -- #509: This copy-transcript.ts module keeps its existing API and workflow boundaries; splitting it requires an ownership design. EOF-scoped exception applies only to this file-level line metric. */
export {
  eveCopyInlineAttachments,
  EveCopyNotReadyError,
  eveCopyResources,
  materializeEveCopyTranscript,
  prepareEveCopyTranscript,
  rewriteEveCopyResources,
};
