/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../../tools/chatjs/saved-code-execution/document-runs" dependency within this package instead of introducing an alias or barrel API.
 */
import type { EveMessage, EveMessagePart } from "eve/client";
import { expect, it } from "vitest";

import { latestDocumentRun } from "../../tools/chatjs/saved-code-execution/document-runs";
/* oxlint-enable import/no-relative-parent-imports */

const documentId = "60dbe86a-b2c4-4d32-ae09-a00e90b84e99";
const revisionId = "663ccf42-10c9-453f-b9da-ebf684a6da97";
const otherRevision = "82280f81-cb77-496d-b2fa-89878ca29c81";

const run = (toolCallId: string, revision = revisionId): EveMessagePart => ({
  input: { documentId, revisionId: revision },
  state: "input-available",
  toolCallId,
  toolName: "runCodeDocument",
  type: "dynamic-tool",
});

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): it("projects the latest matching execution without leaking output between revisions") uses 0, 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
it("projects the latest matching execution without leaking output between revisions", () => {
  const messages: EveMessage[] = [
    { id: "first", parts: [run("old")], role: "assistant" },
    {
      id: "second",
      parts: [run("new"), run("other", otherRevision)],
      role: "assistant",
    },
  ];
  expect(latestDocumentRun(messages, documentId, revisionId)).toEqual({
    messageId: "second",
    part: run("new"),
  });
  expect(latestDocumentRun(messages, documentId, otherRevision)).toEqual({
    messageId: "second",
    part: run("other", otherRevision),
  });
  expect(
    latestDocumentRun(messages, otherRevision, revisionId)
  ).toBeUndefined();
  expect(
    latestDocumentRun(messages.slice(0, 1), documentId, revisionId)
  ).toEqual({ messageId: "first", part: run("old") });
});
/* oxlint-enable no-magic-numbers */
