"use client";

import React from "react";

import type { DocumentBodyProps } from "@/lib/eve/document-ui";
import { documentUi } from "@/tools/chatjs/document-ui";
/* oxlint-disable react/jsx-props-no-spreading, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types -- DocumentBody: ; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

export const DocumentBody = ({
  kind,
  ...props
}: DocumentBodyProps & {
  kind: "text" | "code" | "sheet";
}) => {
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
/* oxlint-enable react/jsx-props-no-spreading, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */
