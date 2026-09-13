"use client";

import type { EveMessagePart } from "eve/client";

import { getInstalledToolRenderer } from "@/lib/ai/tool-renderer-registry";

export function EveToolResult({
  part,
  messageId,
  isReadonly,
}: {
  part: Extract<EveMessagePart, { type: "dynamic-tool" }>;
  messageId: string;
  isReadonly: boolean;
}) {
  const Renderer = getInstalledToolRenderer(`tool-${part.toolName}`);
  if (!Renderer) {
    return null;
  }
  return <Renderer isReadonly={isReadonly} messageId={messageId} tool={part} />;
}
