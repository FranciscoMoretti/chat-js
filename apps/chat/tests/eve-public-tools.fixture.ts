import type { EveMessage, EveMessagePart } from "eve/client";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EveSharedMessages } from "../components/eve/eve-shared-messages";
import { sharedEvePart } from "../lib/eve/shared-messages";

const parts: EveMessagePart[] = [
  {
    type: "dynamic-tool",
    toolCallId: "approval",
    toolName: "example",
    input: { note: "Published note" },
    state: "approval-requested",
    approval: { id: "owner-approval-secret", isAutomatic: true },
  },
  {
    type: "dynamic-tool",
    toolCallId: "declined",
    toolName: "example",
    input: { note: "Declined note" },
    state: "output-denied",
    approval: { id: "owner-approval-secret", approved: false },
  },
  {
    type: "dynamic-tool",
    toolCallId: "complete",
    toolName: "wordCount",
    input: { text: "one two" },
    state: "output-available",
    output: { words: 2, characters: 7, charactersNoSpaces: 6, sentences: 1 },
    approval: { id: "owner-approval-secret", approved: true },
  },
  {
    type: "dynamic-tool",
    toolCallId: "malformed",
    toolName: "codeExecution",
    input: {
      title: "Public code result",
      language: "javascript",
      code: "1 + 1",
    },
    state: "output-available",
    output: {
      kind: "chatjs.platform-result",
      version: 2,
      output: "Unrecognized",
      usage: { costUsd: 99 },
      privateRuntimeToken: "runtime-private",
    },
  },
];
process.stdout.write(
  renderToStaticMarkup(
    createElement(EveSharedMessages, {
      messages: parts.map(
        (part, index): EveMessage => ({
          id: `public-${index}`,
          role: "assistant",
          parts: sharedEvePart(part),
        })
      ),
    })
  )
);
