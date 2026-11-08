import type { EveMessage, EveMessagePart } from "eve/client";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { EveSharedMessages } from "../chatjs/plugins/sharing/ui/transcript-messages";
import { sharedEvePart } from "../lib/eve/shared-messages";

const parts: EveMessagePart[] = [
  {
    input: { note: "Published note" },
    state: "approval",
    callId: "approval",
    name: "example",
    label: "example",
    type: "tool",
    kind: "tool",
    stepIndex: 0,
    interaction: {
      interactionId: "owner-approval-secret",
      turnId: "fixture-turn",
      stepIndex: 0,
      status: "open",
      request: { kind: "approval", prompt: "Approve this tool?" },
    },
  },
  {
    input: { note: "Declined note" },
    state: "rejected",
    callId: "declined",
    name: "example",
    label: "example",
    type: "tool",
    kind: "tool",
    stepIndex: 0,
    interaction: {
      interactionId: "owner-approval-secret",
      turnId: "fixture-turn",
      stepIndex: 0,
      status: "settled",
      outcome: "declined",
      request: { kind: "approval", prompt: "Approve this tool?" },
    },
  },
  {
    input: { text: "one two" },
    output: { characters: 7, charactersNoSpaces: 6, sentences: 1, words: 2 },
    state: "completed",
    callId: "complete",
    name: "wordCount",
    label: "wordCount",
    type: "tool",
    kind: "tool",
    stepIndex: 0,
    interaction: {
      interactionId: "owner-approval-secret",
      turnId: "fixture-turn",
      stepIndex: 0,
      status: "settled",
      outcome: "accepted",
      request: { kind: "approval", prompt: "Approve this tool?" },
    },
  },
  {
    input: {
      code: "1 + 1",
      language: "javascript",
      title: "Public code result",
    },
    output: {
      kind: "chatjs.tool-result",
      output: "Unrecognized",
      privateRuntimeToken: "runtime-private",
      status: "success",
      usage: { costUsd: 99 },
      version: 2,
    },
    state: "completed",
    callId: "malformed",
    name: "codeExecution",
    label: "codeExecution",
    type: "tool",
    kind: "tool",
    stepIndex: 0,
  },
];
process.stdout.write(
  renderToStaticMarkup(
    createElement(EveSharedMessages, {
      messages: parts.map((part: EveMessagePart, index): EveMessage => ({
        id: `public-${index}`,
        parts: sharedEvePart(part),
        role: "assistant",
      })),
    })
  )
);
