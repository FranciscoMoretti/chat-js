"use client";

import React from "react";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { DocumentBodyProps } from "@/lib/eve/document-ui";
/* oxlint-enable sort-imports */
import { documentUi } from "@/tools/chatjs/document-ui";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (DocumentBody); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable react/jsx-no-literals -- DocumentBody renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */
/* oxlint-disable react/jsx-props-no-spreading, typescript/prefer-readonly-parameter-types -- react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

export const DocumentBody = ({
  kind,
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes kind from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
  ...props
}: DocumentBodyProps & {
  kind: "text" | "code" | "sheet";
}): React.JSX.Element => {
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading Body from documentUi[kind]; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  const Body = documentUi[kind]?.Body;
  return Body ? (
    <Body {...props} />
  ) : (
    <div className="p-4 text-sm">
      <output className="text-muted-foreground">
        The {kind} document editor is not installed. Install {kind}-documents to
        edit this document.
      </output>
      <pre className="mt-3 break-words whitespace-pre-wrap">
        {props.editorProps.content}
      </pre>
    </div>
  );
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable react/jsx-props-no-spreading, typescript/prefer-readonly-parameter-types */
