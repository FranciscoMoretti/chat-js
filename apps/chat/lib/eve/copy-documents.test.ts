import {
  eveCopyDocumentResources,
  prepareEveCopyDocuments,
} from "./copy-documents";
import { expect, it } from "vitest";

const documentId = "00000000-0000-4000-8000-000000000001";
const firstId = "00000000-0000-4000-8000-000000000002";
const headId = "00000000-0000-4000-8000-000000000003";
const destinationDoc = "00000000-0000-4000-8000-000000000004";
const destinationFirst = "00000000-0000-4000-8000-000000000005";
const destinationHead = "00000000-0000-4000-8000-000000000006";
const sourceFile = "abcdefghijklmnopqrstuvwx.png";
const destinationFile = "abcdefghijklmnopqrstuvwZ.png";
/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): base uses 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
const base = {
  createdAt: new Date(0),
  documentId,
  fileIds: [sourceFile],
  kind: "text",
  title: "Shared document",
} satisfies Partial<
  Parameters<typeof prepareEveCopyDocuments>[0][number]["revisions"][number]
>;
/* oxlint-enable no-magic-numbers */
/* oxlint-disable unicorn/no-null --
 * unicorn/no-null (#570): snapshot preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
const snapshot = [
  {
    documentId,
    headRevisionId: headId,
    revisions: [
      {
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing base own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
        ...base,
        content: `First version: /api/files/${sourceFile}`,
        id: firstId,
        parentRevisionId: null,
      },
      {
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing base own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
        ...base,
        content: `Document ${documentId}, previous revision ${firstId}`,
        id: headId,
        parentRevisionId: firstId,
      },
    ],
  },
];
/* oxlint-enable unicorn/no-null */
const allocations = {
  documents: new Map([[documentId, destinationDoc]]),
  files: new Map([[sourceFile, destinationFile]]),
  revisions: new Map([
    [firstId, destinationFirst],
    [headId, destinationHead],
  ]),
};

/* oxlint-disable max-statements, no-magic-numbers, unicorn/no-null --
 * max-statements (#512): it("copies every revision with fresh ancestry, rewritten content, and no source turn  keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): it("copies every revision with fresh ancestry, rewritten content, and no source turn  uses 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * unicorn/no-null (#570): it("copies every revision with fresh ancestry, rewritten content, and no source turn  preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
it("copies every revision with fresh ancestry, rewritten content, and no source turn identity", () => {
  const copied = prepareEveCopyDocuments(snapshot, allocations);
  expect(copied[0].revisions[0].fileIds).toEqual([destinationFile]);
  expect(copied[0].documentId).toBe(destinationDoc);
  expect(copied[0].headRevisionId).toBe(destinationHead);
  expect(
    copied[0].revisions.map((row: { readonly id: string }) => row.id)
  ).toEqual([destinationFirst, destinationHead]);
  expect(
    copied[0].revisions.map(
      (row: { readonly parentRevisionId: string | null }) =>
        row.parentRevisionId
    )
  ).toEqual([null, destinationFirst]);
  expect(
    copied[0].revisions.map(
      (row: { readonly turnIndex: number | null }) => row.turnIndex
    )
  ).toEqual([null, null]);
  expect(
    copied[0].revisions.map(
      (row: { readonly operationId: string }) => row.operationId
    )
  ).toEqual([`copy:${destinationFirst}`, `copy:${destinationHead}`]);
  expect(JSON.stringify(copied)).toContain(destinationFile);
  for (const source of [documentId, firstId, headId, sourceFile]) {
    expect(JSON.stringify(copied)).not.toContain(source);
  }
  expect(snapshot[0].revisions[0].id).toBe(firstId);
});
/* oxlint-enable max-statements, no-magic-numbers, unicorn/no-null */

it("retains files from older revisions even when the current head no longer mentions them", () => {
  expect(eveCopyDocumentResources(snapshot)).toEqual({
    documentIds: [documentId],
    fileKeys: [sourceFile],
    revisionIds: [firstId, headId],
  });
});

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): it("rejects incomplete allocations and history instead of flattening document version uses 0, 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
it("rejects incomplete allocations and history instead of flattening document versions", () => {
  expect(() =>
    prepareEveCopyDocuments(snapshot, {
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing allocations own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      ...allocations,
      revisions: new Map([[headId, destinationHead]]),
    })
  ).toThrow("allocated ancestry");
  expect(() =>
    prepareEveCopyDocuments(
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing snapshot[0] own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      [{ ...snapshot[0], revisions: [snapshot[0].revisions[1]] }],
      allocations
    )
  ).toThrow("allocated ancestry");
  expect(() =>
    prepareEveCopyDocuments(
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing snapshot[0] own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      [{ ...snapshot[0], headRevisionId: firstId }],
      allocations
    )
  ).toThrow("head");
  expect(() =>
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing allocations own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    prepareEveCopyDocuments(snapshot, { ...allocations, files: new Map() })
  ).toThrow("Missing copied file");
});
/* oxlint-enable no-magic-numbers */
