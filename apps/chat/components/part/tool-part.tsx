"use client";

import type { ToolUIPart } from "ai";
import type { ComponentType } from "react";
import {
  isInstalledToolType,
  toolRendererRegistry,
} from "@/lib/ai/tool-renderer-registry";
import type { ChatTools } from "@/lib/ai/types";
import { CodeExecution } from "./code-execution";
import { DeepResearch } from "./deep-research";
import { DocumentTool } from "./document-tool";
import { ReadDocument } from "./read-document";
import { WebSearch } from "./web-search";

interface ToolPartProps {
  isReadonly: boolean;
  messageId: string;
  part: ToolUIPart<ChatTools>;
}

type InstalledToolRenderer = ComponentType<{
  tool: ToolUIPart<ChatTools>;
  messageId: string;
  isReadonly: boolean;
}>;

function renderInstalledTool({
  part,
  messageId,
  isReadonly,
}: {
  part: ToolUIPart<ChatTools>;
  messageId: string;
  isReadonly: boolean;
}) {
  const Renderer = (
    toolRendererRegistry as Record<string, InstalledToolRenderer | undefined>
  )[part.type];

  if (!Renderer) {
    return null;
  }

  return <Renderer isReadonly={isReadonly} messageId={messageId} tool={part} />;
}

export function ToolPart({ part, messageId, isReadonly }: ToolPartProps) {
  const type = part.type;

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

  if (type === "tool-codeExecution") {
    return <CodeExecution tool={part} />;
  }

  if (type === "tool-deepResearch") {
    return <DeepResearch messageId={messageId} part={part} />;
  }

  if (type === "tool-webSearch") {
    return <WebSearch messageId={messageId} part={part} />;
  }

  if (isInstalledToolType(type)) {
    return renderInstalledTool({
      part,
      messageId,
      isReadonly,
    });
  }

  return null;
}
