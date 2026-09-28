"use client";

import type { EveMessagePart } from "eve/client";
import { createElement } from "react";

import { getEveInstalledToolRenderer } from "@/lib/ai/tool-renderer-registry";
import { toolOutputSchema } from "@/lib/eve/tool-result";

export const EveToolResult = ({
  part,
  messageId,
  isReadonly,
}: {
  part: Extract<EveMessagePart, { type: "dynamic-tool" }>;
  messageId: string;
  isReadonly: boolean;
}) => {
  const Renderer = getEveInstalledToolRenderer(`tool-${part.toolName}`);
  if (!Renderer) {
    return null;
  }
  const platformOutput =
    part.state === "output-available"
      ? toolOutputSchema.safeParse(part.output)
      : null;
  if (platformOutput?.success && platformOutput.data.status === "error") {
    return createElement(Renderer, {
      isReadonly,
      messageId,
      tool: {
        ...part,
        errorText: platformOutput.data.error,
        state: "output-error",
      },
    });
  }
  const tool = platformOutput?.success
    ? { ...part, output: platformOutput.data.output }
    : part;
  return createElement(Renderer, { isReadonly, messageId, tool });
};
