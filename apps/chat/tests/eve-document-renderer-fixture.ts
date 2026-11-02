import type { EveMessagePart } from "eve/client";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { EveDocumentTool } from "../components/eve/eve-document-tool";
import { ArtifactProvider } from "../hooks/use-artifact";

const parts: Extract<EveMessagePart, { type: "tool" }>[] = [
  {
    input: {},
    state: "requested",
    callId: "loading",
    name: "createTextDocument",
    label: "createTextDocument",
    type: "tool",
    kind: "tool",
    stepIndex: 0,
  },
  {
    input: {},
    state: "requested",
    callId: "reading",
    name: "readDocument",
    label: "readDocument",
    type: "tool",
    kind: "tool",
    stepIndex: 0,
  },
  {
    error: {
      code: "fixture_error",
      message: "Document changed. Reload before saving.",
    },
    input: {},
    state: "failed",
    callId: "error",
    name: "editTextDocument",
    label: "editTextDocument",
    type: "tool",
    kind: "tool",
    stepIndex: 0,
  },
  {
    input: {},
    output: {},
    state: "completed",
    callId: "malformed",
    name: "createTextDocument",
    label: "createTextDocument",
    type: "tool",
    kind: "tool",
    stepIndex: 0,
  },
  {
    input: {},
    state: "rejected",
    callId: "denied",
    name: "editTextDocument",
    label: "editTextDocument",
    type: "tool",
    kind: "tool",
    stepIndex: 0,
    interaction: {
      interactionId: "declined",
      turnId: "fixture-turn",
      stepIndex: 0,
      status: "settled",
      outcome: "declined",
      request: { kind: "approval", prompt: "Approve this tool?" },
    },
  },
  ...["createTextDocument", "editCodeDocument", "readDocument"].map(
    (toolName): Extract<EveMessagePart, { type: "tool" }> => ({
      input: {},
      output: {
        date: "2026-01-01T00:00:00.000Z",
        documentId: "00000000-0000-4000-8000-000000000001",
        kind: "text",
        revisionId: "00000000-0000-4000-8000-000000000002",
        status: "success",
        title: "An orchard document with a long descriptive title",
      },
      state: "completed",
      callId: toolName,
      type: "tool",
      kind: "tool",
      stepIndex: 0,
      name: toolName,
      label: toolName,
    })
  ),
];
process.stdout.write(
  renderToStaticMarkup(
    createElement(
      ArtifactProvider,
      null,
      createElement(
        "main",
        { className: "mx-auto max-w-3xl space-y-5 p-5" },
        parts.map((part) =>
          createElement(
            "section",
            { className: "rounded border p-3", key: part.callId },
            createElement(EveDocumentTool, {
              isReadonly: true,
              messageId: "fixture",
              part,
            })
          )
        )
      )
    )
  )
);
