"use client";

import type { EveMessagePart } from "eve/client";
import { createElement } from "react";

import { getEveInstalledToolRenderer } from "@/lib/ai/tool-renderer-registry";
import { evePlatformOutput } from "@/lib/eve/platform-result";

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
      ? evePlatformOutput.safeParse(part.output)
      : null;
  const tool =
    platformOutput?.success === true
      ? { ...part, output: platformOutput.data.output }
      : part;
  return createElement(Renderer, { isReadonly, messageId, tool });
};
