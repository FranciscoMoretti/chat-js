import type { EveMessage, MessageStreamEvent } from "eve/client";
import { createSessionHistorySeed } from "eve/transcript";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { expect, it } from "vitest";
/* oxlint-enable sort-imports */

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import {
  EveCopyNotReadyError,
  eveCopyInlineAttachments,
  eveCopyResources,
  materializeEveCopyTranscript,
  prepareEveCopyTranscript,
  rewriteEveCopyResources,
} from "./copy-transcript";
/* oxlint-enable sort-imports */

const sourceFile = "aaaaaaaaaaaaaaaaaaaaaaaa.png";
const copiedFile = "bbbbbbbbbbbbbbbbbbbbbbbb.png";
const documentId = "60dbe86a-b2c4-4d32-ae09-a00e90b84e99";
const copiedDocument = "12bb498e-9626-44e6-9497-9a53520458ce";
const revisionId = "663ccf42-10c9-453f-b9da-ebf684a6da97";
const copiedRevision = "1b5b66b4-41bf-4e0b-893f-c5b05a7931fb";
const sourceUrl = `/api/files/${sourceFile}`;
const copiedUrl = `/api/files/${copiedFile}`;
const allocations = {
  documents: new Map([[documentId, copiedDocument]]),
  files: new Map([[sourceFile, copiedFile]]),
  revisions: new Map([[revisionId, copiedRevision]]),
};

/* oxlint-disable typescript/prefer-readonly-parameter-types --
 * typescript/prefer-readonly-parameter-types (#565): history accepts messages: EveMessage[]; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
const history = (messages: EveMessage[]): MessageStreamEvent[] => [
  {
    data: { messages },
    meta: { at: "2026-09-12T00:00:00Z", id: "seed-event" },
    type: "history.seeded",
  },
  {
    data: { continuationToken: "source-token", wait: "next-user-message" },
    meta: { at: "2026-09-12T00:00:01Z", id: "idle-event" },
    type: "session.waiting",
  },
];
/* oxlint-enable typescript/prefer-readonly-parameter-types */

it("prepares exactly the public content without execution, approval or billing identities", () => {
  const events = history([
    {
      id: "source-user",
      parts: [{ text: "Question", type: "text" }],
      role: "user",
    },
    {
      id: "source-assistant",
      metadata: { turnId: "private-turn" },
      parts: [
        { state: "done", text: "Visible reasoning", type: "reasoning" },
        {
          input: { prompt: "Image" },
          output: {
            kind: "chatjs.tool-result",
            output: { url: sourceUrl },
            status: "success",
            usage: { costUsd: 3 },
            version: 1,
          },
          state: "output-available",
          toolCallId: "private-call",
          toolName: "generateImage",
          type: "dynamic-tool",
        },
        { state: "done", text: "Answer", type: "text" },
      ],
      role: "assistant",
    },
  ]);
  const result = prepareEveCopyTranscript(events);
  const serialized = JSON.stringify(result.seed);
  expect(serialized).toContain("Visible reasoning");
  expect(serialized).toContain("Answer");
  expect(result.resources.fileKeys).toEqual([sourceFile]);
  for (const secret of [
    "source-user",
    "source-assistant",
    "private-turn",
    "private-call",
    "costUsd",
  ]) {
    expect(serialized).not.toContain(secret);
  }
  expect(prepareEveCopyTranscript(events).projectionHash).toBe(
    result.projectionHash
  );
});

it("rewrites nested tool inputs, results, document identities and prose using one detached copy", () => {
  const value = {
    content: `![image](${sourceUrl}) Target document: ${documentId}. Selected revision: ${revisionId}.`,
    input: { documentId, expectedRevisionId: revisionId },
    output: { versions: [{ image: sourceUrl, revisionId }] },
  };
  const before = JSON.stringify(value);
  const resources = eveCopyResources(value, true);
  expect(resources).toEqual({
    documentIds: [documentId],
    fileKeys: [sourceFile],
    revisionIds: [revisionId],
  });
  const copied = rewriteEveCopyResources(value, allocations, true);
  expect(copied).toEqual({
    content: `![image](${copiedUrl}) Target document: ${copiedDocument}. Selected revision: ${copiedRevision}.`,
    input: { documentId: copiedDocument, expectedRevisionId: copiedRevision },
    output: { versions: [{ image: copiedUrl, revisionId: copiedRevision }] },
  });
  expect(JSON.stringify(value)).toBe(before);
  expect(eveCopyResources(value.content).fileKeys).toEqual([sourceFile]);
  expect(rewriteEveCopyResources(value.content, allocations, true)).toContain(
    copiedUrl
  );
});

/* oxlint-disable typescript/prefer-readonly-parameter-types --
 * typescript/prefer-readonly-parameter-types (#565): it.each([ { documents: allocations.documents, files: new Map<string, string>(), revis accepts mapping; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
it.each([
  {
    documents: allocations.documents,
    files: new Map<string, string>(),
    revisions: allocations.revisions,
  },
  {
    documents: new Map<string, string>(),
    files: allocations.files,
    revisions: allocations.revisions,
  },
  {
    documents: allocations.documents,
    files: allocations.files,
    revisions: new Map<string, string>(),
  },
])(
  "never falls back to a source resource when an allocation is missing",
  (mapping) => {
    expect(() =>
      rewriteEveCopyResources(
        { documentId, revisionId, url: sourceUrl },
        mapping,
        true
      )
    ).toThrow("Missing copied");
  }
);
/* oxlint-enable typescript/prefer-readonly-parameter-types */

it("preserves inline attachments and tool error or denial content without approval receipts", () => {
  const result = prepareEveCopyTranscript(
    history([
      {
        id: "user",
        parts: [
          {
            filename: "note.pdf",
            mediaType: "application/pdf",
            type: "file",
            url: "data:application/pdf;base64,JVBERg==",
          },
        ],
        role: "user",
      },
      {
        id: "answer",
        parts: [
          {
            approval: {
              approved: false,
              id: "private-receipt",
              reason: "Declined",
            },
            input: {},
            state: "output-denied",
            toolCallId: "denied-call",
            toolName: "confirm_note",
            type: "dynamic-tool",
          },
          {
            errorText: "Unavailable",
            input: {},
            state: "output-error",
            toolCallId: "error-call",
            toolName: "readDocument",
            type: "dynamic-tool",
          },
        ],
        role: "assistant",
      },
    ])
  );
  expect(JSON.stringify(result.seed)).toContain(
    "data:application/pdf;base64,JVBERg=="
  );
  expect(JSON.stringify(result.seed)).toContain('"reason":"Declined"');
  expect(JSON.stringify(result.seed)).not.toContain("private-receipt");
});

/* oxlint-disable typescript/prefer-readonly-parameter-types --
 * typescript/prefer-readonly-parameter-types (#565): it.each<EveMessage["parts"][number]>([ { state: "streaming", text: "Partial", type: " accepts part; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
it.each<EveMessage["parts"][number]>([
  { state: "streaming", text: "Partial", type: "text" },
  {
    input: {},
    state: "input-available",
    toolCallId: "call",
    toolName: "tool",
    type: "dynamic-tool",
  },
  {
    input: {},
    output: {},
    partial: true,
    state: "output-available",
    toolCallId: "call",
    toolName: "tool",
    type: "dynamic-tool",
  },
  {
    approval: { id: "private" },
    input: {},
    state: "approval-requested",
    toolCallId: "call",
    toolName: "tool",
    type: "dynamic-tool",
  },
])("refuses incomplete visible parts rather than dropping them", (part) => {
  expect(() =>
    prepareEveCopyTranscript(
      history([{ id: "answer", parts: [part], role: "assistant" }])
    )
  ).toThrow(EveCopyNotReadyError);
});
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): it("requires a durable idle boundary, including when a new turn has no assistant text uses 0, 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
it("requires a durable idle boundary, including when a new turn has no assistant text yet", () => {
  const events = history([
    {
      id: "question",
      parts: [{ text: "Question", type: "text" }],
      role: "user",
    },
  ]);
  expect(() => prepareEveCopyTranscript(events.slice(0, 1))).toThrow(
    EveCopyNotReadyError
  );
  const received: MessageStreamEvent = {
    data: { message: "Next question", sequence: 1, turnId: "turn_1" },
    meta: { at: "2026-09-12T00:00:02Z", id: "new" },
    type: "message.received",
  };
  expect(() => prepareEveCopyTranscript([...events, received])).toThrow(
    EveCopyNotReadyError
  );
});
/* oxlint-enable no-magic-numbers */

it("canonicalizes file links so a copied private key is never sent to the source hostname", () => {
  const content = `![image](https://old.example${sourceUrl})`;
  expect(rewriteEveCopyResources(content, allocations)).toBe(
    `![image](${copiedUrl})`
  );
});

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
it("keeps MCP document identifiers separate from native ChatJS artifacts", async () => {
  const prepared = prepareEveCopyTranscript(
    history([
      {
        id: "answer",
        parts: [
          {
            input: { documentId: "GoogleDocId" },
            output: { documentId, revisionId: "GoogleRevisionId" },
            state: "output-available",
            toolCallId: "call",
            toolName: "mcp_google_docs",
            type: "dynamic-tool",
          },
        ],
        role: "assistant",
      },
    ])
  );
  expect(prepared.resources.documentIds).toEqual([]);
  expect(prepared.resources.revisionIds).toEqual([]);
  const result = await materializeEveCopyTranscript(
    prepared.seed,
    allocations,
    () => {
      throw new Error("Unexpected file read");
    },
    "https://chatjs.example"
  );
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing prepared.seed own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
  expect(result).toEqual({ ...prepared.seed, attachments: "channel" });
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable typescript/promise-function-async --
 * typescript/promise-function-async (#606): it("materializes only allocated destination attachments and remaps case-insensitive n preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
it("materializes only allocated destination attachments and remaps case-insensitive native document references", async () => {
  const prepared = prepareEveCopyTranscript(
    history([
      {
        id: "user",
        parts: [{ mediaType: "image/png", type: "file", url: sourceUrl }],
        role: "user",
      },
      {
        id: "answer",
        parts: [
          {
            input: { documentId: documentId.toUpperCase() },
            output: { documentId, revisionId },
            state: "output-available",
            toolCallId: "call",
            toolName: "readDocument",
            type: "dynamic-tool",
          },
          {
            text: `Target document: ${documentId.toUpperCase()}`,
            type: "text",
          },
        ],
        role: "assistant",
      },
    ])
  );
  expect(prepared.resources.documentIds).toEqual([documentId]);
  const reads: string[] = [];
  const result = await materializeEveCopyTranscript(
    prepared.seed,
    allocations,
    (key) => {
      reads.push(key);
      return Promise.resolve({ size: 11, type: "image/png" });
    },
    "https://chatjs.example"
  );
  expect(reads).toEqual([copiedFile]);
  expect(JSON.stringify(result)).toContain(
    `https://chatjs.example/api/files/${copiedFile}`
  );
  expect(JSON.stringify(result)).toContain(copiedDocument);
  expect(JSON.stringify(result)).not.toContain(documentId);
  expect(JSON.stringify(result)).not.toContain(sourceFile);
  expect(JSON.stringify(prepared.seed)).toContain(sourceFile);
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable typescript/promise-function-async */

it("does not mutate frozen inputs while collecting copy resources", () => {
  const value = Object.freeze({ nested: Object.freeze({ url: sourceUrl }) });
  expect(eveCopyResources(value).fileKeys).toEqual([sourceFile]);
});

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable no-magic-numbers, typescript/promise-function-async --
 * no-magic-numbers (#517): it("keeps attachment bytes out of the seed and reads destination metadata once per fi uses 1, 1024, 0, 6, 2048 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/promise-function-async (#606): it("keeps attachment bytes out of the seed and reads destination metadata once per fi preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
it("keeps attachment bytes out of the seed and reads destination metadata once per file", async () => {
  const prepared = prepareEveCopyTranscript(
    history([
      {
        id: "user",
        parts: Array.from({ length: 6 }, () => ({
          mediaType: "image/png",
          type: "file",
          url: sourceUrl,
        })),
        role: "user",
      },
    ])
  );
  let reads = 0;
  const result = await materializeEveCopyTranscript(
    prepared.seed,
    allocations,
    () => {
      reads += 1;
      return Promise.resolve({ size: 1024 * 1024, type: "image/png" });
    },
    "https://chatjs.example"
  );
  expect(reads).toBe(1);
  expect(result.attachments).toBe("channel");
  expect(result.messages[0].parts).toHaveLength(6);
  expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThan(2048);
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers, typescript/promise-function-async */

/* oxlint-disable id-length, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async --
 * id-length (#506): it("externalizes six distinct inline images through durable destination allocations") uses _ as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * no-magic-numbers (#517): it("externalizes six distinct inline images through durable destination allocations") uses 1024, 8, 6, 24, 2048, 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/prefer-readonly-parameter-types (#565): it("externalizes six distinct inline images through durable destination allocations") accepts file; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): it("externalizes six distinct inline images through durable destination allocations") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
it("externalizes six distinct inline images through durable destination allocations", async () => {
  const prepared = prepareEveCopyTranscript(
    history([
      {
        id: "user",
        parts: Array.from({ length: 6 }, (_, index) => ({
          mediaType: "image/png",
          type: "file",
          url: `data:image/png;base64,${Buffer.alloc(1024 * 1024, index).toString("base64")}`,
        })),
        role: "user",
      },
    ])
  );
  expect(Buffer.byteLength(JSON.stringify(prepared.seed))).toBeGreaterThan(
    8 * 1024 * 1024
  );
  const files = eveCopyInlineAttachments(prepared.seed);
  expect(files).toHaveLength(6);
  const inlineFiles = new Map(
    files.map((file, index) => [
      file.id,
      `${String(index).padStart(24, "a")}.png`,
    ])
  );
  const result = await materializeEveCopyTranscript(
    prepared.seed,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing allocations own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    { ...allocations, inlineFiles },
    () =>
      Promise.resolve({
        size: 1024 * 1024,
        type: "image/png",
      }),
    "https://chatjs.example"
  );
  expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThan(2048);
  expect(JSON.stringify(result)).not.toContain("base64");
  for (const [index, file] of files.entries()) {
    expect(file.bytes[0]).toBe(index);
  }
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable id-length, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */

/* oxlint-disable typescript/promise-function-async --
 * typescript/promise-function-async (#606): it("refuses missing inline allocations and metadata changes before dispatch") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
it("refuses missing inline allocations and metadata changes before dispatch", async () => {
  const prepared = prepareEveCopyTranscript(
    history([
      {
        id: "user",
        parts: [
          {
            mediaType: "image/png",
            type: "file",
            url: "data:image/png;base64,aGk=",
          },
        ],
        role: "user",
      },
    ])
  );
  const [file] = eveCopyInlineAttachments(prepared.seed);
  await expect(
    materializeEveCopyTranscript(
      prepared.seed,
      allocations,
      () => Promise.resolve({ size: 2, type: "image/png" }),
      "https://chatjs.example"
    )
  ).rejects.toThrow("allocation");
  await expect(
    materializeEveCopyTranscript(
      prepared.seed,
      {
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing allocations own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
        ...allocations,
        inlineFiles: new Map([[file.id, "abcdefghijklmnopqrstuvwZ.png"]]),
      },
      () => Promise.resolve({ size: 3, type: "image/png" }),
      "https://chatjs.example"
    )
  ).rejects.toThrow("metadata changed");
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable typescript/promise-function-async */

it.each([
  "data:image/png;base64,aGk",
  "data:image/png;base64,aGk=!!!",
  "data:application/pdf;base64,aGk=",
])("rejects noncanonical inline file %s", (url) => {
  const prepared = prepareEveCopyTranscript(
    history([
      {
        id: "user",
        parts: [{ mediaType: "image/png", type: "file", url }],
        role: "user",
      },
    ])
  );
  expect(() => eveCopyInlineAttachments(prepared.seed)).toThrow(
    "inline attachment"
  );
});

it("rejects resource allocations that reuse source identities or collide", () => {
  expect(() =>
    rewriteEveCopyResources(sourceUrl, {
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing allocations own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      ...allocations,
      files: new Map([[sourceFile, sourceFile]]),
    })
  ).toThrow("Invalid copied file");
  expect(() =>
    rewriteEveCopyResources(
      { documentId },
      {
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing allocations own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
        ...allocations,
        documents: new Map([[documentId, documentId.toUpperCase()]]),
      },
      true
    )
  ).toThrow("fresh document identities");
  expect(() =>
    rewriteEveCopyResources(sourceUrl, {
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing allocations own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      ...allocations,
      files: new Map([
        [sourceFile, copiedFile],
        ["cccccccccccccccccccccccc.png", copiedFile],
      ]),
    })
  ).toThrow("Invalid copied file");
});

it.each([
  `//foreign.example${sourceUrl}`,
  `HTTPS://foreign.example${sourceUrl}`,
  `https:\\\\foreign.example${sourceUrl}`,
])("canonicalizes browser-valid source URL %s", (url) => {
  expect(rewriteEveCopyResources(url, allocations)).toBe(copiedUrl);
});

it("does not inject destination keys into a foreign URL's query string", () => {
  const url = `https://foreign.example/?next=${sourceUrl}`;
  expect(eveCopyResources(url).fileKeys).toEqual([]);
  expect(rewriteEveCopyResources(url, allocations)).toBe(url);
});

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it.each(["not-a-valid-document-id", documentId])'s awaited sequencing and rejected-Promise behavior. */
it.each(["not-a-valid-document-id", documentId])(
  "preserves failed document arguments that do not denote copied artifacts: %s",
  async (id) => {
    const prepared = prepareEveCopyTranscript(
      history([
        {
          id: "answer",
          parts: [
            {
              errorText: "Document not found",
              input: { documentId: id },
              state: "output-error",
              toolCallId: "call",
              toolName: "readDocument",
              type: "dynamic-tool",
            },
          ],
          role: "assistant",
        },
      ])
    );
    expect(prepared.resources.documentIds).toEqual([]);
    const seed = await materializeEveCopyTranscript(
      prepared.seed,
      {
        documents: new Map(),
        files: new Map(),
        revisions: new Map(),
      },
      () => {
        throw new Error("Unexpected file read");
      },
      "https://chatjs.example"
    );
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing prepared.seed own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    expect(seed).toEqual({ ...prepared.seed, attachments: "channel" });
  }
);
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): it("retains model provenance in copies of copies without carrying private metadata") uses 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
it("retains model provenance in copies of copies without carrying private metadata", () => {
  const events = history([
    {
      id: "seed_message_0",
      parts: [{ text: "Question", type: "text" }],
      role: "user",
    },
    {
      id: "seed_message_1",
      metadata: {
        modelId: "gateway/google/gemini-2.5-flash-lite",
        result: "private-result",
      },
      parts: [{ text: "Answer", type: "text" }],
      role: "assistant",
    },
  ]);
  const copy = prepareEveCopyTranscript(events);
  expect(copy.seed.messages[1]).toEqual({
    modelId: "gateway/google/gemini-2.5-flash-lite",
    parts: [{ text: "Answer", type: "text" }],
    role: "assistant",
  });
  expect(JSON.stringify(copy.seed)).not.toContain("private-result");
});
/* oxlint-enable no-magic-numbers */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): it("preserves selected tools in copies without publishing unrelated custom metadata") uses 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
it("preserves selected tools in copies without publishing unrelated custom metadata", () => {
  const result = prepareEveCopyTranscript(
    history([
      {
        id: "source-user",
        metadata: {
          custom: {
            chatjs: {
              privateToken: "owner-only",
              selectedTool: "createTextDocument",
            },
            integration: { token: "integration-secret" },
          },
        },
        parts: [{ text: "Create a document", type: "text" }],
        role: "user",
      },
    ])
  );
  expect(result.seed.messages[0]).toEqual({
    metadata: { chatjs: { selectedTool: "createTextDocument" } },
    parts: [{ text: "Create a document", type: "text" }],
    role: "user",
  });
});
/* oxlint-enable no-magic-numbers */

/* oxlint-disable max-lines-per-function, no-magic-numbers --
 * max-lines-per-function (#510): it("preserves imported text tool results through the ChatJS shared-copy projection") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): it("preserves imported text tool results through the ChatJS shared-copy projection") uses 1, 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
it("preserves imported text tool results through the ChatJS shared-copy projection", () => {
  const imported = createSessionHistorySeed([
    { content: "Read the file", role: "user" },
    {
      content: [
        {
          input: { path: "notes.txt" },
          toolCallId: "original",
          toolName: "readFile",
          type: "tool-call",
        },
      ],
      role: "assistant",
    },
    {
      content: [
        {
          output: { type: "text", value: "plain text" },
          toolCallId: "original",
          toolName: "readFile",
          type: "tool-result",
        },
      ],
      role: "tool",
    },
  ]);
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading parts from imported.seed.messages[1]; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  const tool = imported.seed.messages[1]?.parts[0];
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading type from tool; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  if (tool?.type !== "dynamic-tool" || tool.state !== "output-available") {
    throw new Error("Expected settled imported tool");
  }
  const messages: EveMessage[] = [
    {
      id: "seed_message_0",
      parts: [{ text: "Read the file", type: "text" }],
      role: "user",
    },
    {
      id: "seed_message_1",
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing tool own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      parts: [{ ...tool, toolCallId: "seed_tool_0" }],
      role: "assistant",
    },
  ];
  const copied = prepareEveCopyTranscript(history(messages));
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading parts from copied.seed.messages[1]; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  expect(copied.seed.messages[1]?.parts[0]).toMatchObject({
    output: "plain text",
    outputType: "text",
    state: "output-available",
    type: "dynamic-tool",
  });
  expect(JSON.stringify(copied.seed)).not.toContain("original");
});
/* oxlint-enable max-lines-per-function, no-magic-numbers */

it.each([sourceUrl, `${sourceUrl}?dpl=dpl_test`])(
  "copies file references from %s into canonical paths",
  (url) => {
    const content = `![image](${url})`;
    expect(eveCopyResources(content).fileKeys).toEqual([sourceFile]);
    expect(rewriteEveCopyResources(content, allocations)).toBe(
      `![image](${copiedUrl})`
    );
  }
);

it("copies explicit file identities alongside their stable URLs", () => {
  const source = {
    fileId: sourceFile,
    fileIds: [sourceFile],
    imageUrl: sourceUrl,
  };
  expect(eveCopyResources(source).fileKeys).toEqual([sourceFile]);
  expect(rewriteEveCopyResources(source, allocations)).toEqual({
    fileId: allocations.files.get(sourceFile),
    fileIds: [allocations.files.get(sourceFile)],
    imageUrl: copiedUrl,
  });
});

/* oxlint-disable max-lines -- #509: This copy-transcript.test.ts module keeps its existing fixture/scenario boundaries; splitting it requires an ownership design. EOF-scoped exception applies only to this file-level line metric. */
