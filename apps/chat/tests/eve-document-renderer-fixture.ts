import type { EveMessagePart } from "eve/client";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { EveDocumentTool } from "../components/eve/eve-document-tool";
import { ArtifactProvider } from "../hooks/use-artifact";

const parts: Extract<EveMessagePart, { type: "dynamic-tool" }>[] = [
  {
    input: {},
    state: "input-available",
    toolCallId: "loading",
    toolName: "createTextDocument",
    type: "dynamic-tool",
  },
  {
    input: {},
    state: "input-available",
    toolCallId: "reading",
    toolName: "readDocument",
    type: "dynamic-tool",
  },
  {
    errorText: "Document changed. Reload before saving.",
    input: {},
    state: "output-error",
    toolCallId: "error",
    toolName: "editTextDocument",
    type: "dynamic-tool",
  },
  {
    input: {},
    output: {},
    state: "output-available",
    toolCallId: "malformed",
    toolName: "createTextDocument",
    type: "dynamic-tool",
  },
  {
    approval: { approved: false, id: "declined" },
    input: {},
    state: "output-denied",
    toolCallId: "denied",
    toolName: "editTextDocument",
    type: "dynamic-tool",
  },
  ...["createTextDocument", "editCodeDocument", "readDocument"].map(
    (toolName): Extract<EveMessagePart, { type: "dynamic-tool" }> => ({
      input: {},
      output: {
        date: "2026-01-01T00:00:00.000Z",
        documentId: "00000000-0000-4000-8000-000000000001",
        kind: "text",
        revisionId: "00000000-0000-4000-8000-000000000002",
        status: "success",
        title: "An orchard document with a long descriptive title",
      },
      state: "output-available",
      toolCallId: toolName,
      toolName,
      type: "dynamic-tool",
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
            { className: "rounded border p-3", key: part.toolCallId },
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
