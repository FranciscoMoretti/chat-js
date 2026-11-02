"use client";

import { createElement } from "react";

import {
  getEveInstalledToolRenderer,
  renderInstalledTool,
} from "@/lib/ai/tool-renderer-registry";
import type { ReadonlyEveMessagePart } from "@/lib/eve/readonly-message-types";
import { isChatToolPart } from "@/lib/ai/chat-message";
import type { ChatToolPart } from "@/lib/ai/chat-message";
import { toolDisplayPart } from "@/lib/ai/project-chat-messages";

export const EveToolResult = ({
  part,
  messageId,
  isReadonly,
}: {
  readonly part:
    | Extract<ReadonlyEveMessagePart, { readonly type: "dynamic-tool" }>
    | ChatToolPart;
  readonly messageId: string;
  readonly isReadonly: boolean;
}) => {
  if (isChatToolPart(part)) {
    return renderInstalledTool(part.type, {
      tool: part,
      messageId,
      isReadonly,
    });
  }
  const Renderer = getEveInstalledToolRenderer(`tool-${part.toolName}`);
  if (!Renderer) {
    return null;
  }
  const tool = toolDisplayPart(part) ?? part;
  return createElement(Renderer, { isReadonly, messageId, tool });
};
