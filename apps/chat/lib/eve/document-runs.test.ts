import type { EveMessage, EveMessagePart } from "eve/client";
import { expect, it } from "vitest";
import { latestDocumentRun } from "./document-runs";

const documentId = "60dbe86a-b2c4-4d32-ae09-a00e90b84e99";
const revisionId = "663ccf42-10c9-453f-b9da-ebf684a6da97";
const otherRevision = "82280f81-cb77-496d-b2fa-89878ca29c81";

function run(toolCallId: string, revision = revisionId): EveMessagePart {
  return {
    type: "dynamic-tool",
    toolName: "runCodeDocument",
    toolCallId,
    state: "input-available",
    input: { documentId, revisionId: revision },
  };
}

it("projects the latest matching execution without leaking output between revisions", () => {
  const messages: EveMessage[] = [
    { id: "first", role: "assistant", parts: [run("old")] },
    {
      id: "second",
      role: "assistant",
      parts: [run("new"), run("other", otherRevision)],
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
