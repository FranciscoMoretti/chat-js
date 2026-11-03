import type { EveMessagePart } from "eve/client";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { EveDocumentRun } from "../chatjs/tools/saved-code-execution/document";

const input = {
  documentId: "60dbe86a-b2c4-4d32-ae09-a00e90b84e99",
  revisionId: "663ccf42-10c9-453f-b9da-ebf684a6da97",
};
const base = {
  input,
  callId: "run",
  name: "runCodeDocument",
  label: "runCodeDocument",
  type: "tool" as const,
  kind: "tool" as const,
  stepIndex: 0,
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
    part: { ...base, state: "requested" },
    title: "Running",
  },
  {
    part: {
      ...base,
      error: { code: "fixture_error", message: "Code document not found." },
      state: "failed",
    },
    title: "Execution error",
  },
  {
    part: {
      ...base,

      state: "rejected",
    },
    title: "Declined",
  },
  {
    part: { ...base, output: {}, state: "completed" },
    readOnly: true,
    title: "Malformed result",
  },
];

process.stdout.write(
  renderToStaticMarkup(
    createElement(
      "main",
      { className: "mx-auto max-w-3xl space-y-4 p-4" },
      states.map(
        ({ title, part, disabled, readOnly }: (typeof states)[number]) =>
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
              onAction:
                readOnly === true
                  ? undefined
                  : () => {
                      // Static rendering only needs an available action.
                    },
              title: "saved.js",
            })
          )
      )
    )
  )
);
