import type { EveMessagePart } from "eve/client";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { EveDocumentTool } from "../components/eve/eve-document-tool";
import { ArtifactProvider } from "../hooks/use-artifact";

const parts: Extract<EveMessagePart, { type: "dynamic-tool" }>[] = [
  {
    type: "dynamic-tool",
    toolName: "createTextDocument",
    toolCallId: "loading",
    state: "input-available",
    input: {},
  },
  {
    type: "dynamic-tool",
    toolName: "readDocument",
    toolCallId: "reading",
    state: "input-available",
    input: {},
  },
  {
    type: "dynamic-tool",
    toolName: "editTextDocument",
    toolCallId: "error",
    state: "output-error",
    input: {},
    errorText: "Document changed. Reload before saving.",
  },
  {
    type: "dynamic-tool",
    toolName: "createTextDocument",
    toolCallId: "malformed",
    state: "output-available",
    input: {},
    output: {},
  },
  {
    type: "dynamic-tool",
    toolName: "editTextDocument",
    toolCallId: "denied",
    state: "output-denied",
    input: {},
    approval: { id: "declined", approved: false },
  },
  ...["createTextDocument", "editCodeDocument", "readDocument"].map(
    (toolName): Extract<EveMessagePart, { type: "dynamic-tool" }> => ({
      type: "dynamic-tool",
      toolName,
      toolCallId: toolName,
      state: "output-available",
      input: {},
      output: {
        status: "success",
        documentId: "00000000-0000-4000-8000-000000000001",
        revisionId: "00000000-0000-4000-8000-000000000002",
        title: "An orchard document with a long descriptive title",
        kind: "text",
        date: "2026-01-01T00:00:00.000Z",
      },
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
            { key: part.toolCallId, className: "rounded border p-3" },
            createElement(EveDocumentTool, {
              part,
              messageId: "fixture",
              isReadonly: true,
            })
          )
        )
      )
    )
  )
);
