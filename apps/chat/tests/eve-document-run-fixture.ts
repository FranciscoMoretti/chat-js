/* oxlint-disable eslint/sort-keys -- Fixture field order mirrors serialized protocol and persistence payloads. */
import type { EveMessagePart } from "eve/client";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { EveDocumentRun } from "../components/eve/eve-document-run";

const input = {
  documentId: "60dbe86a-b2c4-4d32-ae09-a00e90b84e99",
  revisionId: "663ccf42-10c9-453f-b9da-ebf684a6da97",
};
const base = {
  input,
  toolCallId: "run",
  toolName: "runCodeDocument",
  type: "dynamic-tool" as const,
};
const states: {
  title: string;
  part?: EveMessagePart;
  disabled?: boolean;
  readOnly?: boolean;
}[] = [
  { title: "Ready" },
  { disabled: true, title: "Unsaved changes" },
  {
    disabled: true,
    part: { ...base, state: "input-available" },
    title: "Running",
  },
  {
    part: {
      ...base,
      errorText: "Code document not found.",
      state: "output-error",
    },
    title: "Execution error",
  },
  {
    part: {
      ...base,
      approval: { approved: false, id: "declined" },
      state: "output-denied",
    },
    title: "Declined",
  },
  {
    part: { ...base, output: {}, state: "output-available" },
    readOnly: true,
    title: "Malformed result",
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
          { className: "rounded border p-3", key: title },
          createElement("h2", null, title),
          createElement(EveDocumentRun, {
            ...input,
            disabled: disabled ?? false,
            kind: "code",
            messages: part
              ? [{ id: title, role: "assistant", parts: [part] }]
              : [],
            onAction: readOnly ? undefined : () => Promise.resolve(),
            title: "saved.js",
          })
        )
      )
    )
  )
);
