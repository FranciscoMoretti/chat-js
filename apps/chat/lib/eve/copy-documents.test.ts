import { expect, it } from "vitest";
import {
  eveCopyDocumentResources,
  prepareEveCopyDocuments,
} from "./copy-documents";

const documentId = "00000000-0000-4000-8000-000000000001";
const firstId = "00000000-0000-4000-8000-000000000002";
const headId = "00000000-0000-4000-8000-000000000003";
const destinationDoc = "00000000-0000-4000-8000-000000000004";
const destinationFirst = "00000000-0000-4000-8000-000000000005";
const destinationHead = "00000000-0000-4000-8000-000000000006";
const sourceFile = "abcdefghijklmnopqrstuvwx.png";
const destinationFile = "abcdefghijklmnopqrstuvwZ.png";
const base = {
  documentId,
  kind: "text",
  title: "Shared document",
  createdAt: new Date(0),
} satisfies Partial<
  Parameters<typeof prepareEveCopyDocuments>[0][number]["revisions"][number]
>;
const snapshot = [
  {
    documentId,
    headRevisionId: headId,
    revisions: [
      {
        ...base,
        id: firstId,
        parentRevisionId: null,
        content: `First version: /api/files/content?key=${sourceFile}`,
      },
      {
        ...base,
        id: headId,
        parentRevisionId: firstId,
        content: `Document ${documentId}, previous revision ${firstId}`,
      },
    ],
  },
];
const allocations = {
  files: new Map([[sourceFile, destinationFile]]),
  documents: new Map([[documentId, destinationDoc]]),
  revisions: new Map([
    [firstId, destinationFirst],
    [headId, destinationHead],
  ]),
};

it("copies every revision with fresh ancestry, rewritten content, and no source turn identity", () => {
  const copied = prepareEveCopyDocuments(snapshot, allocations);
  expect(copied[0].documentId).toBe(destinationDoc);
  expect(copied[0].headRevisionId).toBe(destinationHead);
  expect(copied[0].revisions.map((row) => row.id)).toEqual([
    destinationFirst,
    destinationHead,
  ]);
  expect(copied[0].revisions.map((row) => row.parentRevisionId)).toEqual([
    null,
    destinationFirst,
  ]);
  expect(copied[0].revisions.map((row) => row.turnIndex)).toEqual([null, null]);
  expect(copied[0].revisions.map((row) => row.operationId)).toEqual([
    `copy:${destinationFirst}`,
    `copy:${destinationHead}`,
  ]);
  expect(JSON.stringify(copied)).toContain(destinationFile);
  for (const source of [documentId, firstId, headId, sourceFile]) {
    expect(JSON.stringify(copied)).not.toContain(source);
  }
  expect(snapshot[0].revisions[0].id).toBe(firstId);
});

it("retains files from older revisions even when the current head no longer mentions them", () => {
  expect(eveCopyDocumentResources(snapshot)).toEqual({
    fileKeys: [sourceFile],
    documentIds: [documentId],
    revisionIds: [firstId, headId],
  });
});

it("rejects incomplete allocations and history instead of flattening document versions", () => {
  expect(() =>
    prepareEveCopyDocuments(snapshot, {
      ...allocations,
      revisions: new Map([[headId, destinationHead]]),
    })
  ).toThrow("allocated ancestry");
  expect(() =>
    prepareEveCopyDocuments(
      [{ ...snapshot[0], revisions: [snapshot[0].revisions[1]] }],
      allocations
    )
  ).toThrow("allocated ancestry");
  expect(() =>
    prepareEveCopyDocuments(
      [{ ...snapshot[0], headRevisionId: firstId }],
      allocations
    )
  ).toThrow("head");
  expect(() =>
    prepareEveCopyDocuments(snapshot, { ...allocations, files: new Map() })
  ).toThrow("Missing copied file");
});
