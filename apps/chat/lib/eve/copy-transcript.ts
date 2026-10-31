import { activeTurn, idle, session, turns } from "eve/events";
import { conversationOf } from "eve/client";
import { EveForkBoundaryError } from "./fork-boundary-error";
import { isNonEmptyString } from "@/lib/is-non-empty-string";

import type { EveMessageDisplayReceipt } from "./message-display";
import type { SessionStreamEvent } from "eve/client";
import { FILES_PATH, isFileStorageKey, keyFromFileUrl } from "@/lib/file-url";
import { eveMessageTool, eveToolMetadata } from "./message-tool-selection";
import type { EveCopySeed } from "./copy-seed";
import type {
  ReadonlyEveMessagePart,
  ReadonlyEveMessageMetadata,
} from "./readonly-message-types";
import { createHash } from "node:crypto";
import { eveDocumentOperations } from "./document-contracts";
import { sharedEveMessages } from "./shared-messages";
import { z } from "zod";

type Seed = EveCopySeed;
type SeedPart = Seed["messages"][number]["parts"][number];
const MIN_FILE_URL_LENGTH = 1;
const EMPTY_CONTENT_LENGTH = 0;

const RESOURCE_TOKEN = /[^\s<>()"'`[\]]+/gu;
const SENTENCE_END = /[.,;:!?]+$/u;
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
    super(
      "Wait for the conversation to finish successfully before copying it."
    );
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
  if (part.type !== "tool") {
    throw new EveCopyNotReadyError();
  }
  const base = {
    type: "dynamic-tool" as const,
    toolName: part.name,
    input: z.json().parse(part.input),
  };
  if (part.state === "completed") {
    return {
      ...base,
      state: "output-available",
      output: z.json().parse(part.output),
    };
  }
  if (part.state === "failed") {
    return {
      ...base,
      state: "output-error",
      errorText: part.error?.message ?? "Tool failed",
    };
  }
  if (part.state === "rejected") {
    return { ...base, state: "output-denied" };
  }
  throw new EveCopyNotReadyError();
};
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
        part.state === "completed" &&
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
    ...resources,
    documentIds: [...documents].toSorted(),
    revisionIds: [...revisions].toSorted(),
  };
};
const copyUserSeedMessage = (message: {
  readonly role: string;
  readonly parts: readonly ReadonlyEveMessagePart[];
  readonly metadata?: ReadonlyEveMessageMetadata;
}): Seed["messages"][number] => {
  const selectedTool = eveMessageTool(message);
  return {
    role: "user",
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
  readonly metadata?: ReadonlyEveMessageMetadata;
}): Seed["messages"][number] => ({
  role: "assistant",

  ...(isNonEmptyString(message.metadata?.modelId)
    ? { modelId: message.metadata.modelId }
    : {}),
  parts: message.parts.map(completedPart),
});

/**
 * Prepares a sanitized completed transcript without model calls or storage access.
 * @param {readonly SessionStreamEvent[]} events Ordered native events whose latest copy boundary must be waiting or completed.
 * @param {readonly EveMessageDisplayReceipt[]} receipts Owner-scoped positive bindings for display-only selection metadata.
 * @param {string} beforeMessageId Optional user message to replace; only the preceding transcript is seeded.
 * @returns {{ seed: Seed; projectionHash: string; resources: ReturnType<typeof transcriptResources>; }} The seed, its sanitized projection hash, and application resources to allocate; incomplete content throws.
 */
const prepareEveCopyTranscript = (
  events: readonly SessionStreamEvent[],
  receipts: readonly EveMessageDisplayReceipt[] = [],
  beforeMessageId?: string
): {
  seed: Seed;
  projectionHash: string;
  resources: ReturnType<typeof transcriptResources>;
} => {
  const { view } = conversationOf(events);
  const lastTurn = turns(view).at(-1);
  if (
    !idle(view) ||
    activeTurn(view) ||
    (lastTurn && lastTurn.outcome !== "completed") ||
    session(view).outcome === "failed"
  ) {
    throw new EveCopyNotReadyError();
  }
  const transcript = sharedEveMessages(events, receipts);
  const boundaryIndex =
    beforeMessageId === undefined
      ? transcript.length
      : transcript.findIndex((message) => message.id === beforeMessageId);
  if (
    beforeMessageId !== undefined &&
    (boundaryIndex < 0 || transcript[boundaryIndex]?.role !== "user")
  ) {
    throw new EveForkBoundaryError();
  }
  const messages: Seed["messages"] = transcript
    .slice(0, boundaryIndex)
    .map(
      (message: {
        readonly role: string;
        readonly parts: readonly ReadonlyEveMessagePart[];
        readonly metadata?: ReadonlyEveMessageMetadata;
      }): Seed["messages"][number] => {
        if (message.role === "user") {
          return copyUserSeedMessage(message);
        }
        return copyAssistantSeedMessage(message);
      }
    );
  if (
    (beforeMessageId === undefined &&
      messages.length === EMPTY_CONTENT_LENGTH) ||
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
export { EveCopyNotReadyError, eveCopyResources, prepareEveCopyTranscript };
