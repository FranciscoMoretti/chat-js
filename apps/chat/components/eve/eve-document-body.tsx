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
  return Body ? <Body {...props} /> : null;
};
