/* oxlint-disable sort-imports --
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import { expect, it } from "vitest";

import {
  eveCopyDocumentResources,
  prepareEveCopyDocuments,
} from "./copy-documents";
/* oxlint-enable sort-imports */

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
/* oxlint-disable oxc/no-rest-spread-properties, unicorn/no-null --
 * oxc/no-rest-spread-properties (#543): snapshot copies or separates ...base while preserving existing object ownership; mutating source objects is not equivalent.
 * unicorn/no-null (#570): snapshot preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
const snapshot = [
  {
    documentId,
    headRevisionId: headId,
    revisions: [
      {
        ...base,
        content: `First version: /api/files/${sourceFile}`,
        id: firstId,
        parentRevisionId: null,
      },
      {
        ...base,
        content: `Document ${documentId}, previous revision ${firstId}`,
        id: headId,
        parentRevisionId: firstId,
      },
    ],
  },
];
/* oxlint-enable oxc/no-rest-spread-properties, unicorn/no-null */
const allocations = {
  documents: new Map([[documentId, destinationDoc]]),
  files: new Map([[sourceFile, destinationFile]]),
  revisions: new Map([
    [firstId, destinationFirst],
    [headId, destinationHead],
  ]),
};

/* oxlint-disable max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, unicorn/no-null --
 * max-statements (#512): it("copies every revision with fresh ancestry, rewritten content, and no source turn  keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): it("copies every revision with fresh ancestry, rewritten content, and no source turn  uses 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/prefer-readonly-parameter-types (#565): it("copies every revision with fresh ancestry, rewritten content, and no source turn  accepts row; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * unicorn/no-null (#570): it("copies every revision with fresh ancestry, rewritten content, and no source turn  preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
it("copies every revision with fresh ancestry, rewritten content, and no source turn identity", () => {
  const copied = prepareEveCopyDocuments(snapshot, allocations);
  expect(copied[0].revisions[0].fileIds).toEqual([destinationFile]);
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
/* oxlint-enable max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, unicorn/no-null */

it("retains files from older revisions even when the current head no longer mentions them", () => {
  expect(eveCopyDocumentResources(snapshot)).toEqual({
    documentIds: [documentId],
    fileKeys: [sourceFile],
    revisionIds: [firstId, headId],
  });
});

/* oxlint-disable no-magic-numbers, oxc/no-rest-spread-properties --
 * no-magic-numbers (#517): it("rejects incomplete allocations and history instead of flattening document version uses 0, 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-rest-spread-properties (#543): it("rejects incomplete allocations and history instead of flattening document version copies or separates ...allocations; ...snapshot[0] while preserving existing object ownership; mutating source objects is not equivalent.
 */
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
/* oxlint-enable no-magic-numbers, oxc/no-rest-spread-properties */
