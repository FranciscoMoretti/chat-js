import type { EveMessage, MessageStreamEvent } from "eve/client";
import { expect, it } from "vitest";
import {
  EveCopyNotReady,
  eveCopyResources,
  materializeEveCopyTranscript,
  prepareEveCopyTranscript,
  rewriteEveCopyResources,
} from "./copy-transcript";

const sourceFile = "aaaaaaaaaaaaaaaaaaaaaaaa.png";
const copiedFile = "bbbbbbbbbbbbbbbbbbbbbbbb.png";
const documentId = "60dbe86a-b2c4-4d32-ae09-a00e90b84e99";
const copiedDocument = "12bb498e-9626-44e6-9497-9a53520458ce";
const revisionId = "663ccf42-10c9-453f-b9da-ebf684a6da97";
const copiedRevision = "1b5b66b4-41bf-4e0b-893f-c5b05a7931fb";
const sourceUrl = `/api/files/content?key=${sourceFile}`;
const copiedUrl = `/api/files/content?key=${copiedFile}`;
const allocations = {
  files: new Map([[sourceFile, copiedFile]]),
  documents: new Map([[documentId, copiedDocument]]),
  revisions: new Map([[revisionId, copiedRevision]]),
};

function history(messages: EveMessage[]): MessageStreamEvent[] {
  return [
    {
      type: "history.seeded",
      meta: { id: "seed-event", at: "2026-09-12T00:00:00Z" },
      data: { messages },
    },
    {
      type: "session.waiting",
      meta: { id: "idle-event", at: "2026-09-12T00:00:01Z" },
      data: { continuationToken: "source-token", wait: "next-user-message" },
    },
  ];
}

it("prepares exactly the public content without execution, approval or billing identities", () => {
  const events = history([
    {
      id: "source-user",
      role: "user",
      parts: [{ type: "text", text: "Question" }],
    },
    {
      id: "source-assistant",
      role: "assistant",
      metadata: { turnId: "private-turn" },
      parts: [
        { type: "reasoning", text: "Visible reasoning", state: "done" },
        {
          type: "dynamic-tool",
          toolName: "generateImage",
          toolCallId: "private-call",
          state: "output-available",
          input: { prompt: "Image" },
          output: {
            kind: "chatjs.platform-result",
            version: 1,
            output: { url: sourceUrl },
            usage: { costUsd: 3 },
          },
        },
        { type: "text", text: "Answer", state: "done" },
      ],
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
    input: { documentId, expectedRevisionId: revisionId },
    output: { versions: [{ revisionId, image: sourceUrl }] },
    content: `![image](${sourceUrl}) Target document: ${documentId}. Selected revision: ${revisionId}.`,
  };
  const before = JSON.stringify(value);
  const resources = eveCopyResources(value, true);
  expect(resources).toEqual({
    fileKeys: [sourceFile],
    documentIds: [documentId],
    revisionIds: [revisionId],
  });
  const copied = rewriteEveCopyResources(value, allocations, true);
  expect(copied).toEqual({
    input: { documentId: copiedDocument, expectedRevisionId: copiedRevision },
    output: { versions: [{ revisionId: copiedRevision, image: copiedUrl }] },
    content: `![image](${copiedUrl}) Target document: ${copiedDocument}. Selected revision: ${copiedRevision}.`,
  });
  expect(JSON.stringify(value)).toBe(before);
  expect(eveCopyResources(value.content).fileKeys).toEqual([sourceFile]);
  expect(rewriteEveCopyResources(value.content, allocations, true)).toContain(
    copiedUrl
  );
});

it.each([
  {
    files: new Map<string, string>(),
    documents: allocations.documents,
    revisions: allocations.revisions,
  },
  {
    files: allocations.files,
    documents: new Map<string, string>(),
    revisions: allocations.revisions,
  },
  {
    files: allocations.files,
    documents: allocations.documents,
    revisions: new Map<string, string>(),
  },
])("never falls back to a source resource when an allocation is missing", (mapping) => {
  expect(() =>
    rewriteEveCopyResources(
      { url: sourceUrl, documentId, revisionId },
      mapping,
      true
    )
  ).toThrow("Missing copied");
});

it("preserves inline attachments and tool error or denial content without approval receipts", () => {
  const result = prepareEveCopyTranscript(
    history([
      {
        id: "user",
        role: "user",
        parts: [
          {
            type: "file",
            mediaType: "application/pdf",
            url: "data:application/pdf;base64,JVBERg==",
            filename: "note.pdf",
          },
        ],
      },
      {
        id: "answer",
        role: "assistant",
        parts: [
          {
            type: "dynamic-tool",
            toolCallId: "denied-call",
            toolName: "confirm_note",
            input: {},
            state: "output-denied",
            approval: {
              id: "private-receipt",
              approved: false,
              reason: "Declined",
            },
          },
          {
            type: "dynamic-tool",
            toolCallId: "error-call",
            toolName: "readDocument",
            input: {},
            state: "output-error",
            errorText: "Unavailable",
          },
        ],
      },
    ])
  );
  expect(JSON.stringify(result.seed)).toContain(
    "data:application/pdf;base64,JVBERg=="
  );
  expect(JSON.stringify(result.seed)).toContain('"reason":"Declined"');
  expect(JSON.stringify(result.seed)).not.toContain("private-receipt");
});

it.each<EveMessage["parts"][number]>([
  { type: "text", text: "Partial", state: "streaming" },
  {
    type: "dynamic-tool",
    toolCallId: "call",
    toolName: "tool",
    input: {},
    state: "input-available",
  },
  {
    type: "dynamic-tool",
    toolCallId: "call",
    toolName: "tool",
    input: {},
    output: {},
    state: "output-available",
    partial: true,
  },
  {
    type: "dynamic-tool",
    toolCallId: "call",
    toolName: "tool",
    input: {},
    state: "approval-requested",
    approval: { id: "private" },
  },
])("refuses incomplete visible parts rather than dropping them", (part) => {
  expect(() =>
    prepareEveCopyTranscript(
      history([{ id: "answer", role: "assistant", parts: [part] }])
    )
  ).toThrow(EveCopyNotReady);
});

it("requires a durable idle boundary, including when a new turn has no assistant text yet", () => {
  const events = history([
    {
      id: "question",
      role: "user",
      parts: [{ type: "text", text: "Question" }],
    },
  ]);
  expect(() => prepareEveCopyTranscript(events.slice(0, 1))).toThrow(
    EveCopyNotReady
  );
  const received: MessageStreamEvent = {
    type: "message.received",
    meta: { id: "new", at: "2026-09-12T00:00:02Z" },
    data: { message: "Next question", sequence: 1, turnId: "turn_1" },
  };
  expect(() => prepareEveCopyTranscript([...events, received])).toThrow(
    EveCopyNotReady
  );
});

it("canonicalizes file links so a copied private key is never sent to the source hostname", () => {
  const content = `![image](https://old.example${sourceUrl})`;
  expect(rewriteEveCopyResources(content, allocations)).toBe(
    `![image](${copiedUrl})`
  );
});

it("keeps MCP document identifiers separate from native ChatJS artifacts", async () => {
  const prepared = prepareEveCopyTranscript(
    history([
      {
        id: "answer",
        role: "assistant",
        parts: [
          {
            type: "dynamic-tool",
            toolName: "mcp_google_docs",
            toolCallId: "call",
            state: "output-available",
            input: { documentId: "GoogleDocId" },
            output: { documentId, revisionId: "GoogleRevisionId" },
          },
        ],
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
    }
  );
  expect(result).toEqual(prepared.seed);
});

it("materializes only allocated destination attachments and remaps case-insensitive native document references", async () => {
  const prepared = prepareEveCopyTranscript(
    history([
      {
        id: "user",
        role: "user",
        parts: [{ type: "file", mediaType: "image/png", url: sourceUrl }],
      },
      {
        id: "answer",
        role: "assistant",
        parts: [
          {
            type: "dynamic-tool",
            toolName: "readDocument",
            toolCallId: "call",
            input: { documentId: documentId.toUpperCase() },
            state: "output-available",
            output: { documentId, revisionId },
          },
          {
            type: "text",
            text: `Target document: ${documentId.toUpperCase()}`,
          },
        ],
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
      return Promise.resolve(new Blob(["image bytes"], { type: "image/png" }));
    }
  );
  expect(reads).toEqual([copiedFile]);
  expect(JSON.stringify(result)).toContain(
    "data:image/png;base64,aW1hZ2UgYnl0ZXM="
  );
  expect(JSON.stringify(result)).toContain(copiedDocument);
  expect(JSON.stringify(result)).not.toContain(documentId);
  expect(JSON.stringify(result)).not.toContain(sourceFile);
  expect(JSON.stringify(prepared.seed)).toContain(sourceFile);
});

it("does not mutate frozen inputs while collecting copy resources", () => {
  const value = Object.freeze({ nested: Object.freeze({ url: sourceUrl }) });
  expect(eveCopyResources(value).fileKeys).toEqual([sourceFile]);
});

it("reports the native size limit before dispatch rather than silently dropping supported attachments", async () => {
  const prepared = prepareEveCopyTranscript(
    history([
      {
        id: "user",
        role: "user",
        parts: Array.from({ length: 6 }, () => ({
          type: "file",
          mediaType: "image/png",
          url: sourceUrl,
        })),
      },
    ])
  );
  await expect(
    materializeEveCopyTranscript(prepared.seed, allocations, () =>
      Promise.resolve(
        new Blob([new Uint8Array(1024 * 1024)], { type: "image/png" })
      )
    )
  ).rejects.toThrow("copy size limit");
});

it("rejects resource allocations that reuse source identities or collide", () => {
  expect(() =>
    rewriteEveCopyResources(sourceUrl, {
      ...allocations,
      files: new Map([[sourceFile, sourceFile]]),
    })
  ).toThrow("Invalid copied file");
  expect(() =>
    rewriteEveCopyResources(
      { documentId },
      {
        ...allocations,
        documents: new Map([[documentId, documentId.toUpperCase()]]),
      },
      true
    )
  ).toThrow("fresh document identities");
  expect(() =>
    rewriteEveCopyResources(sourceUrl, {
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

it.each([
  "not-a-valid-document-id",
  documentId,
])("preserves failed document arguments that do not denote copied artifacts: %s", async (id) => {
  const prepared = prepareEveCopyTranscript(
    history([
      {
        id: "answer",
        role: "assistant",
        parts: [
          {
            type: "dynamic-tool",
            toolName: "readDocument",
            toolCallId: "call",
            state: "output-error",
            input: { documentId: id },
            errorText: "Document not found",
          },
        ],
      },
    ])
  );
  expect(prepared.resources.documentIds).toEqual([]);
  const seed = await materializeEveCopyTranscript(
    prepared.seed,
    {
      files: new Map(),
      documents: new Map(),
      revisions: new Map(),
    },
    () => {
      throw new Error("Unexpected file read");
    }
  );
  expect(seed).toEqual(prepared.seed);
});
