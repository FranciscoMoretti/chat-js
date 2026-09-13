import { createHash } from "node:crypto";

import type { EveChannelInput } from "eve/channels/eve";
import type { EveMessagePart, MessageStreamEvent } from "eve/client";
import { z } from "zod";

import {
  FILE_CONTENT_PATH,
  isFileStorageKey,
  keyFromFileUrl,
} from "../file-url";
import { eveDocumentOperations } from "./document-contracts";
import { eveMessageTool, eveToolMetadata } from "./message-tool-selection";
import { sharedEveMessages } from "./shared-messages";

type Seed = NonNullable<
  Awaited<ReturnType<NonNullable<EveChannelInput["resolveSeed"]>>>
>;
type SeedPart = Seed["messages"][number]["parts"][number];

const INLINE_FILE_ID = /^[a-f0-9]{64}$/;
const RESOURCE_TOKEN = /[^\s<>()"'`[\]]+/g;
const SENTENCE_END = /[.,;:!?]+$/;
const UUID_REFERENCE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
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

export class EveCopyNotReady extends Error {
  constructor() {
    super("Wait for the shared conversation to finish before saving a copy.");
  }
}

function completedPart(part: EveMessagePart): SeedPart {
  if (part.type === "text" || part.type === "reasoning") {
    if (part.state === "streaming") {
      throw new EveCopyNotReady();
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
    throw new EveCopyNotReady();
  }
  const base = {
    type: part.type,
    toolName: part.toolName,
    input: z.json().parse(part.input),
  };
  switch (part.state) {
    case "output-available":
      if (part.partial) {
        throw new EveCopyNotReady();
      }
      return {
        ...base,
        state: part.state,
        output: z.json().parse(part.output),
      };
    case "output-error":
      return { ...base, state: part.state, errorText: part.errorText };
    case "output-denied":
      return { ...base, state: part.state, reason: part.approval.reason };
    default:
      throw new EveCopyNotReady();
  }
}

/** Pure preparation: no model calls, storage access, or source runtime identities. */
export function prepareEveCopyTranscript(
  events: readonly MessageStreamEvent[]
) {
  const boundary = events.findLast((event) => COPY_BOUNDARIES.has(event.type));
  if (
    boundary?.type !== "session.waiting" &&
    boundary?.type !== "session.completed"
  ) {
    throw new EveCopyNotReady();
  }
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
  if (!messages.length || messages.some((message) => !message.parts.length)) {
    throw new EveCopyNotReady();
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
}

/** Also use for every authorized document revision's content before reserving keys. */
export function eveCopyResources(value: unknown, documentReferences = false) {
  const files = new Set<string>();
  const documents = new Set<string>();
  const revisions = new Set<string>();
  visitStrings({ value }, (text, field) => {
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
    fileKeys: [...files].sort(),
    documentIds: [...documents].sort(),
    revisionIds: [...revisions].sort(),
  };
}

type CopyAllocations = {
  files: ReadonlyMap<string, string>;
  documents: ReadonlyMap<string, string>;
  revisions: ReadonlyMap<string, string>;
  inlineFiles?: ReadonlyMap<string, string>;
};

/** Maps come from durable, ownership-checked allocations, never from browser input. */
export function rewriteEveCopyResources<T>(
  value: T,
  allocations: CopyAllocations,
  documentReferences = false
): T {
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
      let result = transformFileReferences(text, (source) => {
        const key = allocations.files.get(source);
        if (!key) {
          throw new Error("Missing copied file allocation.");
        }
        return `${FILE_CONTENT_PATH}?key=${key}`;
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
}

function transcriptResources(seed: Seed) {
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
    documentIds: [...documents].sort(),
    revisionIds: [...revisions].sort(),
  };
}

/** Decode only published attachment parts; IDs bind their MIME type and exact bytes. */
export function eveCopyInlineAttachments(seed: Seed) {
  const files = new Map<
    string,
    { id: string; mediaType: string; bytes: Buffer }
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
}

function decodeInlineAttachment(part: Extract<SeedPart, { type: "file" }>) {
  const prefix = `data:${part.mediaType};base64,`;
  if (!part.url.startsWith(prefix)) {
    throw new Error("Invalid inline attachment content type.");
  }
  const encoded = part.url.slice(prefix.length);
  const bytes = Buffer.from(encoded, "base64");
  if (!bytes.length || bytes.toString("base64") !== encoded) {
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
}

/** Metadata binds planned destination bytes; acceptance requires matching committed receipts. */
export async function materializeEveCopyTranscript(
  seed: Seed,
  allocations: CopyAllocations,
  loadDestinationFile: (key: string) => Promise<Pick<Blob, "type" | "size">>,
  origin: string
): Promise<Seed> {
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
}

function copyAttachmentResolver(
  allocations: CopyAllocations,
  loadDestinationFile: (key: string) => Promise<Pick<Blob, "type" | "size">>,
  origin: string
) {
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
  return async (part: Extract<SeedPart, { type: "file" }>) => {
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
    part.url = new URL(`${FILE_CONTENT_PATH}?key=${key}`, origin).href;
    part.size = stored.size;
  };
}

function rewriteDocumentPart(part: SeedPart, allocations: CopyAllocations) {
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
}

function transformFileReferences(
  text: string,
  replace: (key: string) => string
) {
  return text.replace(RESOURCE_TOKEN, (token) => {
    const candidate = token.replace(SENTENCE_END, "");
    if (!candidate.includes(FILE_CONTENT_PATH)) {
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
}

function visitStrings(
  value: unknown,
  rewrite: (text: string, field?: string) => string,
  mutate = false
) {
  if (!value || typeof value !== "object") {
    return;
  }
  for (const key of Object.keys(value)) {
    const item: unknown = Reflect.get(value, key);
    if (typeof item === "string") {
      const replacement = rewrite(item, key);
      if (mutate) {
        Reflect.set(value, key, replacement);
      }
    } else {
      visitStrings(item, rewrite, mutate);
    }
  }
}
