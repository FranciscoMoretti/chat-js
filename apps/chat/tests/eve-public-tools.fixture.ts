import type { EveMessage, EveMessagePart } from "eve/client";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { EveSharedMessages } from "../components/eve/eve-shared-messages";
import { sharedEvePart } from "../lib/eve/shared-messages";

const parts: EveMessagePart[] = [
  {
    approval: { id: "owner-approval-secret", isAutomatic: true },
    input: { note: "Published note" },
    state: "approval-requested",
    toolCallId: "approval",
    toolName: "example",
    type: "dynamic-tool",
  },
  {
    approval: { approved: false, id: "owner-approval-secret" },
    input: { note: "Declined note" },
    state: "output-denied",
    toolCallId: "declined",
    toolName: "example",
    type: "dynamic-tool",
  },
  {
    approval: { approved: true, id: "owner-approval-secret" },
    input: { text: "one two" },
    output: { characters: 7, charactersNoSpaces: 6, sentences: 1, words: 2 },
    state: "output-available",
    toolCallId: "complete",
    toolName: "wordCount",
    type: "dynamic-tool",
  },
  {
    input: {
      code: "1 + 1",
      language: "javascript",
      title: "Public code result",
    },
    output: {
      kind: "chatjs.platform-result",
      output: "Unrecognized",
      privateRuntimeToken: "runtime-private",
      usage: { costUsd: 99 },
      version: 2,
    },
    state: "output-available",
    toolCallId: "malformed",
    toolName: "codeExecution",
    type: "dynamic-tool",
  },
];
process.stdout.write(
  renderToStaticMarkup(
    createElement(EveSharedMessages, {
      messages: parts.map((part, index): EveMessage => ({
        id: `public-${index}`,
        parts: sharedEvePart(part),
        role: "assistant",
      })),
    })
  )
);
