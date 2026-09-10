import type { EveMessagePart } from "eve/client";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EveDocumentRun } from "../components/eve/eve-document-run";

const input = {
  documentId: "60dbe86a-b2c4-4d32-ae09-a00e90b84e99",
  revisionId: "663ccf42-10c9-453f-b9da-ebf684a6da97",
};
const base = {
  type: "dynamic-tool" as const,
  toolName: "runCodeDocument",
  toolCallId: "run",
  input,
};
const states: {
  title: string;
  part?: EveMessagePart;
  disabled?: boolean;
  readOnly?: boolean;
}[] = [
  { title: "Ready" },
  { title: "Unsaved changes", disabled: true },
  {
    title: "Running",
    disabled: true,
    part: { ...base, state: "input-available" },
  },
  {
    title: "Execution error",
    part: {
      ...base,
      state: "output-error",
      errorText: "Code document not found.",
    },
  },
  {
    title: "Declined",
    part: {
      ...base,
      state: "output-denied",
      approval: { id: "declined", approved: false },
    },
  },
  {
    title: "Malformed result",
    readOnly: true,
    part: { ...base, state: "output-available", output: {} },
  },
];

process.stdout.write(
  renderToStaticMarkup(
    createElement(
      "main",
      { className: "mx-auto max-w-3xl space-y-4 p-4" },
      states.map(({ title, part, disabled, readOnly }) =>
        createElement(
          "section",
          { key: title, className: "rounded border p-3" },
          createElement("h2", null, title),
          createElement(EveDocumentRun, {
            ...input,
            title: "saved.js",
            kind: "code",
            disabled: disabled ?? false,
            onAction: readOnly ? undefined : () => Promise.resolve(),
            messages: part
              ? [{ id: title, role: "assistant", parts: [part] }]
              : [],
          })
        )
      )
    )
  )
);
