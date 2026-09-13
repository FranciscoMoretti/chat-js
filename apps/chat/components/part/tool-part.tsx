"use client";

import type { ToolUIPart } from "ai";

import {
  isInstalledToolType,
  renderInstalledTool,
} from "@/lib/ai/tool-renderer-registry";
import type { ChatTools } from "@/lib/ai/types";

import { DeepResearch } from "./deep-research";
import { DocumentTool } from "./document-tool";
import { ReadDocument } from "./read-document";

interface ToolPartProps {
  isReadonly: boolean;
  messageId: string;
  part: ToolUIPart<ChatTools>;
}

export const ToolPart = ({ part, messageId, isReadonly }: ToolPartProps) => {
  const { type } = part;

  if (
    type === "tool-createTextDocument" ||
    type === "tool-createCodeDocument" ||
    type === "tool-createSheetDocument" ||
    type === "tool-editTextDocument" ||
    type === "tool-editCodeDocument" ||
    type === "tool-editSheetDocument"
  ) {
    return (
      <DocumentTool isReadonly={isReadonly} messageId={messageId} tool={part} />
    );
  }

  if (type === "tool-readDocument") {
    return <ReadDocument tool={part} />;
  }

  if (type === "tool-deepResearch") {
    return <DeepResearch messageId={messageId} part={part} />;
  }

  if (isInstalledToolType(type)) {
    return renderInstalledTool(type, { isReadonly, messageId, tool: part });
  }

  return null;
};
