"use client";

import React from "react";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { DocumentBodyProps } from "@/lib/eve/document-ui";
/* oxlint-enable sort-imports */
import { documentUi } from "@/tools/chatjs/document-ui";
/* oxlint-disable react/jsx-props-no-spreading, typescript/prefer-readonly-parameter-types -- react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

export const DocumentBody = ({
  kind,
  ...props
}: DocumentBodyProps & {
  kind: "text" | "code" | "sheet";
}): React.JSX.Element => {
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
/* oxlint-enable react/jsx-props-no-spreading, typescript/prefer-readonly-parameter-types */
