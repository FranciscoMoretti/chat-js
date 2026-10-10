/* oxlint-disable import/no-nodejs-modules --
 * import/no-nodejs-modules (#529): This server/tooling module requires import { createHash } from "node:crypto";; its Node runtime boundary deliberately permits these built-ins.
 */
/* oxlint-disable eslint/sort-keys -- Property order is part of persisted EVE request and transcript hashes; keep the original wire representation. */
import type { EveMessage, MessageStreamEvent } from "eve/client";
import {
  FILES_PATH,
  createFileUrl,
  isFileStorageKey,
  keyFromFileUrl,
} from "@/lib/file-url";
import { eveMessageTool, eveToolMetadata } from "./message-tool-selection";
import type { EveChannelInput } from "eve/channels/eve";
import type { ReadonlyEveMessagePart } from "./readonly-message-types";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { createHash } from "node:crypto";
import { eveDocumentOperations } from "./document-contracts";
import { sharedEveMessages } from "./shared-messages";
import { z } from "zod";
/* oxlint-enable import/no-nodejs-modules */

type Seed = NonNullable<
  Awaited<ReturnType<NonNullable<EveChannelInput["resolveSeed"]>>>
>;
type SeedPart = Seed["messages"][number]["parts"][number];
const MIN_FILE_URL_LENGTH = 1;
const EMPTY_CONTENT_LENGTH = 0;
const MAX_TRANSCRIPT_COPY_BYTES = 8_388_608;

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

const copySeedFile = (
  part: Extract<ReadonlyEveMessagePart, { type: "file" }>
): Extract<SeedPart, { type: "file" }> => ({
  type: "file",
  url: z.string().min(MIN_FILE_URL_LENGTH).parse(part.url),
  mediaType: part.mediaType,
  filename: part.filename,
  size: part.size,
});

/* oxlint-disable max-statements --
 * max-statements (#512): completedPart keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
const completedPart = (part: ReadonlyEveMessagePart): SeedPart => {
  if (part.type === "text" || part.type === "reasoning") {
    if (part.state === "streaming") {
      throw new EveCopyNotReadyError();
    }
    return { type: part.type, text: part.text };
  }
  if (part.type === "file") {
    return copySeedFile(part);
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
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing base own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
        ...base,
        state: part.state,
        output: z.json().parse(part.output),
        // oxlint-disable-next-line oxc/no-rest-spread-properties, no-ternary -- Conditional spread (part.outputType ? { outputType: part.outputType } : {}) preserves the selected branch's own keys/values and positional overrides, including absent keys when a branch contributes none; pinned eslint/prefer-object-spread rejects Object.assign.; no-ternary: Keep object spread as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
        ...(part.outputType ? { outputType: part.outputType } : {}),
      };
    }
    case "output-error": {
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing base own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      return { ...base, state: part.state, errorText: part.errorText };
    }
    case "output-denied": {
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing base own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      return { ...base, state: part.state, reason: part.approval.reason };
    }
    default: {
      throw new EveCopyNotReadyError();
    }
  }
};
/* oxlint-enable max-statements */
/* oxlint-disable max-params, max-statements -- * max-params (#511): visitStrings keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): visitStrings keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold. */
const visitStrings = (
  value: unknown,
  rewrite: (text: string, field?: string) => string,
  mutate = false,
  parentField?: string,

  seen: {
    readonly has: (value: object) => boolean;
    readonly add: (value: object) => unknown;
  } = new WeakSet<object>()
): void => {
  if (typeof value !== "object" || value === null) {
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
        // oxlint-disable-next-line no-ternary -- Keep rewrite argument as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
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
/* oxlint-enable max-params, max-statements */
/* oxlint-disable init-declarations, max-statements --
 * init-declarations (#507): transformFileReferences assigns these bindings along its control-flow paths; eager undefined initialization would conflict with no-undefined and obscure definite assignment.
 * max-statements (#512): transformFileReferences keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
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

    if (key !== null) {
      return replace(key) + token.slice(candidate.length);
    }
    return token;
  });
/* oxlint-enable init-declarations, max-statements */
/**
 * Scans copy content before destination keys are reserved.
 * @param {unknown} value Transcript or authorized document revision content to inspect.
 * @param {boolean} documentReferences Whether explicit document and revision fields are collected.
 * @returns {{ fileKeys: string[]; documentIds: string[]; revisionIds: string[] }} Sorted unique file keys, document IDs, and revision IDs found in supported references.
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
    if (
      documentReferences &&
      typeof field === "string" &&
      field !== "" &&
      DOCUMENT_FIELDS.has(field)
    ) {
      documents.add(z.uuid().parse(text).toLowerCase());
    }
    if (
      documentReferences &&
      typeof field === "string" &&
      field !== "" &&
      REVISION_FIELDS.has(field)
    ) {
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
/* oxlint-disable max-statements -- * max-statements (#512): transcriptResources keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold. */
const transcriptResources = (seed: {
  readonly messages: readonly {
    readonly parts: readonly (
      | {
          readonly type: "dynamic-tool";
          readonly state: string;
          readonly toolName: string;
        }
      | { readonly type: Exclude<SeedPart["type"], "dynamic-tool"> }
    )[];
  }[];
}): ReturnType<typeof eveCopyResources> => {
  const resources = eveCopyResources(seed);
  const documents = new Set<string>();
  const revisions = new Set<string>();
  for (const message of seed.messages) {
    for (const part of message.parts) {
      if (
        part.type === "dynamic-tool" &&
        part.state === "output-available" &&
        DOCUMENT_TOOLS.has(part.toolName)
      ) {
        const documentResources = eveCopyResources(part, true);
        for (const id of documentResources.documentIds) {
          documents.add(id);
        }
        for (const id of documentResources.revisionIds) {
          revisions.add(id);
        }
      }
    }
  }
  return {
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing resources own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    ...resources,
    documentIds: [...documents].toSorted(),
    revisionIds: [...revisions].toSorted(),
  };
};
/* oxlint-enable max-statements */
const copyUserSeedMessage = (message: {
  readonly role: string;
  readonly parts: readonly ReadonlyEveMessagePart[];
  readonly metadata?: EveMessage["metadata"];
}): Seed["messages"][number] => {
  const selectedTool = eveMessageTool(message);
  return {
    role: "user",
    // oxlint-disable-next-line oxc/no-rest-spread-properties, no-ternary -- Conditional spread (selectedTool ? { metadata: eveToolMetadata(selectedTool) } : {}) preserves the selected branch's own keys/values and positional overrides, including absent keys when a branch contributes none; pinned eslint/prefer-object-spread rejects Object.assign.; no-ternary: Keep object spread as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
    ...(selectedTool ? { metadata: eveToolMetadata(selectedTool) } : {}),
    parts: message.parts.map((part: ReadonlyEveMessagePart) => {
      if (part.type === "text") {
        return { type: "text", text: part.text };
      }
      if (part.type === "file") {
        return copySeedFile(part);
      }
      throw new Error("Unsupported shared user content.");
    }),
  };
};

const copyAssistantSeedMessage = (message: {
  readonly parts: readonly ReadonlyEveMessagePart[];
  readonly metadata?: EveMessage["metadata"];
}): Seed["messages"][number] => ({
  role: "assistant",
  // oxlint-disable-next-line oxc/no-rest-spread-properties, oxc/no-optional-chaining, no-ternary, typescript/strict-boolean-expressions -- Preserve the original nullable model ID truthiness guard so TypeScript narrows the original metadata receiver without caching or changing either getter read. Conditional spread (message.metadata?.modelId           ? { modelId: message.metadata.modelId }           : {}) preserves the selected branch's own keys/values and positional overrides, including absent keys when a branch contributes none; pinned eslint/prefer-object-spread rejects Object.assign. Optional chain: Keep the existing nullish guard when reading modelId from message.metadata; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.; no-ternary: Keep object spread as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
  ...(message.metadata?.modelId ? { modelId: message.metadata.modelId } : {}),
  parts: message.parts.map(completedPart),
});

/**
 * Prepares a sanitized completed transcript without model calls or storage access.
 * @param {readonly MessageStreamEvent[]} events Ordered native events whose latest copy boundary must be waiting or completed.
 * @returns {{ seed: Seed; projectionHash: string; resources: ReturnType<typeof transcriptResources>; }} The seed, its sanitized projection hash, and application resources to allocate; incomplete content throws.
 */
const prepareEveCopyTranscript = (
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Forward native MessageStreamEvent values to EVE message reconstruction, preserving the SDK recursive message/tool contract.
  events: readonly MessageStreamEvent[]
): {
  seed: Seed;
  projectionHash: string;
  resources: ReturnType<typeof transcriptResources>;
} => {
  const boundary = events.findLast(
    (event: Readonly<Pick<MessageStreamEvent, "type">>) =>
      COPY_BOUNDARIES.has(event.type)
  );
  if (
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading type from boundary; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
    boundary?.type !== "session.waiting" &&
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading type from boundary; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
    boundary?.type !== "session.completed"
  ) {
    throw new EveCopyNotReadyError();
  }
  const messages: Seed["messages"] = sharedEveMessages(events).map(
    (message: {
      readonly role: string;
      readonly parts: readonly ReadonlyEveMessagePart[];
      readonly metadata?: EveMessage["metadata"];
    }): Seed["messages"][number] => {
      if (message.role === "user") {
        return copyUserSeedMessage(message);
      }
      return copyAssistantSeedMessage(message);
    }
  );
  if (
    messages.length === EMPTY_CONTENT_LENGTH ||
    messages.some(
      (message: { readonly parts: readonly unknown[] }) =>
        message.parts.length === EMPTY_CONTENT_LENGTH
    )
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
interface CopyAllocations {
  readonly files: Readonly<ReadonlyMap<string, string>>;
  readonly documents: Readonly<ReadonlyMap<string, string>>;
  readonly revisions: Readonly<ReadonlyMap<string, string>>;
  readonly inlineFiles?: Readonly<ReadonlyMap<string, string>>;
}
/* oxlint-disable init-declarations, max-lines-per-function, max-statements --
init-declarations (#507): rewriteEveCopyResources assigns these bindings along its control-flow paths; eager undefined initialization would conflict with no-undefined and obscure definite assignment.
max-lines-per-function (#510): rewriteEveCopyResources keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
max-statements (#512): rewriteEveCopyResources keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold. */
/**
 * Rewrites a cloned value using durable, ownership-checked destination allocations.
 * @param {Value} value Transcript or document content whose source references are replaced in a clone.
 * @param {CopyAllocations} allocations Reserved destination files, documents, revisions, and inline attachment keys.
 * @param {boolean} documentReferences Whether explicit document/revision fields must be rewritten.
 * @returns {Value} A clone of the same value shape with validated destination references; missing or conflicting allocations throw.
 */
const rewriteEveCopyResources = <Value>(
  value: Value,
  allocations: ReadonlyNativeSurface<
    Readonly<Pick<CopyAllocations, "files" | "documents" | "revisions">>
  >,
  documentReferences = false
): Value => {
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
    [...allocations.documents].map(([from, to]: readonly [string, string]) => [
      from.toLowerCase(),
      to.toLowerCase(),
    ])
  );
  const revisions = new Map(
    [...allocations.revisions].map(([from, to]: readonly [string, string]) => [
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
        if (typeof fileId !== "string" || fileId === "") {
          throw new Error("Missing copied file allocation.");
        }
        return fileId;
      }
      let result = transformFileReferences(text, (source) => {
        const key = allocations.files.get(source);
        if (typeof key !== "string" || key === "") {
          throw new Error("Missing copied file allocation.");
        }
        return createFileUrl(key);
      });
      let map: ReadonlyMap<string, string> | undefined;
      if (
        documentReferences &&
        typeof field === "string" &&
        field !== "" &&
        DOCUMENT_FIELDS.has(field)
      ) {
        map = documents;
      }
      if (
        documentReferences &&
        typeof field === "string" &&
        field !== "" &&
        REVISION_FIELDS.has(field)
      ) {
        map = revisions;
      }
      if (map) {
        const replacement = map.get(text.toLowerCase());
        if (typeof replacement !== "string" || replacement === "") {
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
/* oxlint-enable init-declarations, max-lines-per-function, max-statements */
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
  if (
    bytes.length === EMPTY_CONTENT_LENGTH ||
    bytes.toString("base64") !== encoded
  ) {
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
/**
 * Decodes published inline attachments, binding identity to MIME type and exact bytes.
 * @param {Seed} seed Prepared seed whose file parts may contain base64 data URLs.
 * @returns {{ id: string; mediaType: string; bytes: Buffer }[]} Unique inline attachments with validated media types, byte buffers, and content-bound IDs.
 */
const eveCopyInlineAttachments = (seed: {
  readonly messages: readonly {
    readonly parts: readonly (
      | Readonly<Extract<SeedPart, { type: "file" }>>
      | { readonly type: Exclude<SeedPart["type"], "file"> }
    )[];
  }[];
}): { id: string; mediaType: string; bytes: Buffer }[] => {
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
      if (part.type === "file" && part.url.startsWith("data:")) {
        const file = decodeInlineAttachment(part);
        files.set(file.id, file);
      }
    }
  }
  return [...files.values()];
};
/* oxlint-disable max-lines-per-function, max-statements, no-undefined -- * max-lines-per-function (#510): copyAttachmentResolver keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): copyAttachmentResolver keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-undefined (#519): copyAttachmentResolver uses undefined for absent or optional values; substituting null would alter its type and serialization contract. */
const copyAttachmentResolver = (
  allocations: ReadonlyNativeSurface<
    Readonly<Pick<CopyAllocations, "files" | "inlineFiles">>
  >,
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
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve callbacks in this return statement's awaited sequencing and rejected-Promise behavior. */
  return async (
    part: Extract<
      SeedPart,
      {
        type: "file";
      }
    >
  ): Promise<void> => {
    // oxlint-disable-next-line no-ternary -- Keep inline as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
    const inline = part.url.startsWith("data:")
      ? decodeInlineAttachment(part)
      : undefined;
    const key =
      // oxlint-disable-next-line no-ternary -- Keep key selection lazy; pinned unicorn/prefer-ternary flags the equivalent assignment branches.
      inline === undefined
        ? keyFromFileUrl(part.url)
        : // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading get from allocations.inlineFiles; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
          allocations.inlineFiles?.get(inline.id);
    if (typeof key !== "string" || key === "" || !destinationKeys.has(key)) {
      throw new Error("Missing copied attachment allocation.");
    }
    let file = metadata.get(key);
    if (file === undefined) {
      file = loadDestinationFile(key);
      metadata.set(key, file);
    }
    const stored = await file;
    if (
      stored.type !== part.mediaType ||
      !Number.isSafeInteger(stored.size) ||
      stored.size <= EMPTY_CONTENT_LENGTH ||
      (part.size !== undefined && part.size !== stored.size) ||
      (inline !== undefined && inline.bytes.length !== stored.size)
    ) {
      throw new Error("Copied attachment content metadata changed.");
    }
    part.url = new URL(createFileUrl(key), origin).href;
    part.size = stored.size;
  };
  /* oxlint-enable oxc/no-async-await */
};
/* oxlint-enable max-lines-per-function, max-statements, no-undefined */

const rewriteDocumentPart = (
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- This native seed-part writer updates the original part with Reflect.set.
  part: SeedPart,
  allocations: ReadonlyNativeSurface<
    Readonly<Pick<CopyAllocations, "documents" | "revisions">>
  >
): void => {
  const identities = new Map(
    [...allocations.documents, ...allocations.revisions].map(
      ([from, to]: readonly [string, string]) => [
        from.toLowerCase(),
        to.toLowerCase(),
      ]
    )
  );
  const requireAllocation =
    part.type === "dynamic-tool" && part.state === "output-available";
  visitStrings(
    part,
    (text, field) => {
      if (
        typeof field === "string" &&
        field !== "" &&
        (DOCUMENT_FIELDS.has(field) || REVISION_FIELDS.has(field))
      ) {
        const replacement = identities.get(text.toLowerCase());
        if (
          (typeof replacement !== "string" || replacement === "") &&
          requireAllocation
        ) {
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
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve materializeEveCopyTranscript's awaited sequencing and rejected-Promise behavior. */

/* oxlint-disable max-params, max-statements -- max-params (#511): materializeEveCopyTranscript keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
max-statements (#512): materializeEveCopyTranscript keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold. */
/**
 * Materializes reserved destination attachments and document references in a copied seed.
 * @param {Seed} seed Prepared transcript cloned before destination URLs and metadata are written.
 * @param {CopyAllocations} allocations Durable destination allocations validated against source resource identities.
 * @param {(key: string) => Promise<Pick<Blob, "type" | "size">>} loadDestinationFile Reads committed destination MIME type and size for receipt checks.
 * @param {string} origin HTTP(S) origin used to construct copied file URLs without credentials.
 * @returns {Promise<Seed>} A channel-attachment seed whose metadata matches committed files and fits the copy-size limit.
 */
const materializeEveCopyTranscript = async (
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Preserve the native Seed output and its existing structuredClone ownership; readonly input inference makes cloned attachments and message parts readonly at the native mutable output boundary.
  seed: Seed,
  allocations: ReadonlyNativeSurface<CopyAllocations>,
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
  if (Buffer.byteLength(JSON.stringify(copied)) > MAX_TRANSCRIPT_COPY_BYTES) {
    throw new Error(
      "This conversation exceeds Eve's transcript copy size limit."
    );
  }
  return copied;
};
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (eveCopyInlineAttachments, EveCopyNotReadyError, eveCopyResources, materializeEveCopyTranscript, prepareEveCopyTranscript, rewriteEveCopyResources); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-params, max-statements */

/* oxlint-disable max-lines -- #509: This copy-transcript.ts module keeps its existing API and workflow boundaries; splitting it requires an ownership design. EOF-scoped exception applies only to this file-level line metric. */
export {
  eveCopyInlineAttachments,
  EveCopyNotReadyError,
  eveCopyResources,
  materializeEveCopyTranscript,
  prepareEveCopyTranscript,
  rewriteEveCopyResources,
};
/* oxlint-enable import/no-named-export */
