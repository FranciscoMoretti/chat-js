"use client";

import type { DocumentBodyProps } from "@/lib/eve/document-ui";
import { documentUi } from "@/tools/chatjs/document-ui";

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
    <output className="text-muted-foreground p-4 text-sm">
      The {kind} document editor is not installed. Install {kind}-documents to
      view this document.
    </output>
  );
};
