"use client";

import React from "react";

import type { DocumentBodyProps } from "@/lib/eve/document-ui";
import { documents } from "@/integrations/document-ui";

export const DocumentBody = ({
  kind,
  ...props
}: DocumentBodyProps & {
  readonly kind: string;
}): React.JSX.Element => {
  const Body = documents[kind]?.Body;
  if (Body) {
    return <Body {...props} />;
  }
  return (
    <div className="p-4 text-sm">
      <output className="text-muted-foreground">
        The {kind} document editor is not installed. Reinstall its document
        plugin to edit this document. Your saved content is preserved.
      </output>
      <pre className="mt-3 break-words whitespace-pre-wrap">
        {props.editorProps.content}
      </pre>
    </div>
  );
};
