/* oxlint-disable import/no-relative-parent-imports  --
 * import/no-relative-parent-imports (#530): Keep the explicit "../tools/chatjs/saved-code-execution/document" dependency within this package instead of introducing an alias or barrel API.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
/* oxlint-disable eslint/sort-keys -- Fixture field order mirrors serialized protocol and persistence payloads. */
import type { EveMessagePart } from "eve/client";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { EveDocumentRun } from "../tools/chatjs/saved-code-execution/document";
/* oxlint-enable import/no-relative-parent-imports */

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

/* oxlint-disable no-undefined, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions, unicorn/max-nested-calls, unicorn/no-null  --
 * no-ternary (#518): process.stdout.write derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * no-undefined (#519): process.stdout.write uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * oxc/no-rest-spread-properties (#543): process.stdout.write copies or separates ...input while preserving existing object ownership; mutating source objects is not equivalent.
 * typescript/explicit-function-return-type (#560): Keep process.stdout.write's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): process.stdout.write accepts { title, part, disabled, readOnly }; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): process.stdout.write preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 * typescript/strict-boolean-expressions (#610): process.stdout.write intentionally keeps the existing falsy-value behavior of readOnly; distinguishing empty, zero, and absent states requires a domain behavior decision.
 * unicorn/max-nested-calls (#568): process.stdout.write keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * unicorn/no-null (#570): process.stdout.write preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
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
/* oxlint-enable no-undefined, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions, unicorn/max-nested-calls, unicorn/no-null */
