"use client";
import { eveToolUIState } from "@/lib/eve/tool-ui-state";

import React from "react";
import { Response } from "@/components/ai-elements/response";
import { ToolInput, ToolOutput } from "@/components/part/tool-data";
import { ToolActivity } from "@/components/part/tool-activity";
import { ReasoningPart } from "@/components/part/message-reasoning";
import { eveMcpResult } from "@/lib/eve/mcp-result";
import { getEveInstalledToolRenderer } from "@/lib/ai/tool-renderer-registry";
import type { ReadonlyEveMessagePart } from "@/lib/eve/readonly-message-types";
import { EveAttachment } from "./eve-attachment";
import { EveMcpResult } from "./eve-mcp-result";
import { EveToolResult } from "./eve-tool-result";
import { CodeSnippet } from "@/components/code-snippet";
import { bashResultSchema } from "@/lib/eve/bash-result";
import { BashOutput } from "./bash-output";

const hasStructuredToolRenderer = (
  part: Extract<ReadonlyEveMessagePart, { type: "tool" }>
): boolean =>
  !(part.state === "completed" && typeof part.output === "string") &&
  getEveInstalledToolRenderer(`tool-${part.name}`) !== undefined;

const toolStatus = (
  part: Extract<ReadonlyEveMessagePart, { type: "tool" }>
): string => {
  if (part.state === "approval" || part.state === "blocked") {
    return "Waiting for input.";
  }
  if (part.state === "rejected") {
    return "Request declined.";
  }
  if (part.state === "cancelled") {
    return "Tool stopped.";
  }
  if (part.state === "failed") {
    return part.error?.message ?? "Tool failed";
  }
  if (part.state === "completed") {
    return "Tool completed.";
  }
  return "Working…";
};

const ToolFallback = ({
  part,
  compact,
}: {
  readonly part: Extract<ReadonlyEveMessagePart, { type: "tool" }>;
  readonly compact: boolean;
}): React.JSX.Element => {
  let content: React.ReactNode = (
    <p className="text-muted-foreground text-sm">{toolStatus(part)}</p>
  );
  if (part.state === "failed") {
    content = <ToolOutput errorText={part.error?.message ?? "Tool failed"} />;
  } else if (part.state === "completed" && part.output !== undefined) {
    const bash =
      part.name === "bash"
        ? bashResultSchema.safeParse(part.output)
        : undefined;
    content =
      bash?.success === true ? (
        <BashOutput output={bash.data} />
      ) : (
        <ToolOutput output={part.output} />
      );
  }
  return (
    <ToolActivity
      title={part.name}
      state={eveToolUIState(part.state)}
      defaultOpen={!compact}
    >
      {part.name === "bash" &&
      typeof part.input === "object" &&
      part.input !== null &&
      "command" in part.input &&
      typeof part.input.command === "string" ? (
        <CodeSnippet code={part.input.command} language="bash" />
      ) : (
        <ToolInput
          input={part.state === "streaming" ? part.inputText : part.input}
        />
      )}
      {content}
    </ToolActivity>
  );
};

export const EveMessagePart = ({
  messageId,
  isReadonly,
  part,
  compact = false,
}: {
  readonly messageId: string;
  readonly isReadonly: boolean;
  readonly part: Exclude<ReadonlyEveMessagePart, { type: "interaction" }>;
  readonly compact?: boolean;
}): React.JSX.Element => {
  if (part.type === "text") {
    return <Response>{part.text}</Response>;
  }
  if (part.type === "file") {
    return <EveAttachment part={part} />;
  }
  if (part.type === "reasoning") {
    return (
      <ReasoningPart
        content={part.text}
        isLoading={part.state === "streaming"}
      />
    );
  }
  if (part.state === "approval" || part.state === "blocked") {
    return <ToolFallback part={part} compact={compact} />;
  }
  if (hasStructuredToolRenderer(part)) {
    return (
      <EveToolResult
        isReadonly={isReadonly}
        messageId={messageId}
        part={part}
      />
    );
  }

  if (
    part.state === "completed" &&
    eveMcpResult.safeParse(part.output).success
  ) {
    return <EveMcpResult part={part} />;
  }
  return <ToolFallback part={part} compact={compact} />;
};
