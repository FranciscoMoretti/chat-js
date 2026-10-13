"use client";

import React from "react";

import type { DocumentBodyProps } from "@/lib/eve/document-ui";
import { documentUi } from "@/tools/chatjs/document-ui";

export const DocumentBody = ({
  kind,
  ...props
}: DocumentBodyProps & {
  readonly kind: "text" | "code" | "sheet";
}): React.JSX.Element => {
  const Body = documentUi[kind]?.Body;
  if (Body) {
    return <Body {...props} />;
  }
  return (
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
