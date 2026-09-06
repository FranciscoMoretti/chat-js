"use client";

import { memo, useEffect, useRef } from "react";
import { useArtifact } from "@/hooks/use-artifact";
import type { ChatMessage } from "@/lib/ai/types";
import { useIsLastArtifact } from "@/lib/stores/hooks-message-parts";
import {
  type DocumentToolType,
  getToolKind,
  isEditTool,
} from "@/tools/platform/documents/types";
import { DocumentPreview } from "./document-preview";

type DocumentTool = Extract<
  ChatMessage["parts"][number],
  { type: DocumentToolType }
>;

interface DocumentToolComponentProps {
  isReadonly: boolean;
  messageId: string;
  tool: DocumentTool;
}

function PureDocumentTool({
  tool,
  isReadonly,
  messageId,
}: DocumentToolComponentProps) {
  const { artifact, openArtifact } = useArtifact();
  const opened = useRef(false);
  const kind = getToolKind(tool.type);
  const isEdit = isEditTool(tool.type);
  const isLastArtifact = useIsLastArtifact(tool.toolCallId);

  const inputTitle = tool.input?.title ?? "";
  const inputContent = tool.input?.content ?? "";

  // Auto-open a newly streamed document once. The workspace then owns its subscription.
  useEffect(() => {
    if (
      opened.current ||
      (tool.state !== "input-streaming" && tool.state !== "input-available")
    ) {
      return;
    }
    opened.current = true;
    if (artifact.isVisible || artifact.messageId === messageId) {
      return;
    }
    openArtifact({
      documentId: "init",
      title: inputTitle,
      content: inputContent,
      kind,
      messageId,
      toolCallId: tool.toolCallId,
      status: "streaming",
      isVisible: true,
    });
  }, [
    artifact.isVisible,
    artifact.messageId,
    tool.state,
    tool.toolCallId,
    messageId,
    kind,
    inputTitle,
    inputContent,
    openArtifact,
  ]);

  if (tool.state === "output-error" || tool.output?.status === "error") {
    const output = tool.output;
    const error = output?.status === "error" ? output.error : tool.errorText;

    return (
      <div className="rounded border p-2 text-red-500">Error: {error}</div>
    );
  }

  if (
    tool.state === "input-streaming" ||
    tool.state === "input-available" ||
    (tool.state === "output-available" && tool.output)
  ) {
    return (
      <DocumentPreview
        input={{ title: inputTitle, kind, content: inputContent }}
        isLastArtifact={isLastArtifact}
        isReadonly={isReadonly}
        messageId={messageId}
        output={
          tool.output
            ? {
                documentId: tool.output.documentId,
                title: inputTitle,
                kind,
              }
            : undefined
        }
        toolCallId={tool.toolCallId}
        type={isEdit ? "update" : "create"}
      />
    );
  }

  return null;
}

export const DocumentTool = memo(
  PureDocumentTool,
  (prevProps, nextProps) =>
    prevProps.tool.state === nextProps.tool.state &&
    prevProps.tool.input?.title === nextProps.tool.input?.title &&
    prevProps.tool.input?.content === nextProps.tool.input?.content &&
    prevProps.tool.output === nextProps.tool.output &&
    prevProps.tool.errorText === nextProps.tool.errorText &&
    prevProps.isReadonly === nextProps.isReadonly &&
    prevProps.messageId === nextProps.messageId
);
