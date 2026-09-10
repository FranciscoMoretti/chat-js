"use client";

import type { EveMessagePart } from "eve/client";
import { defineToolRenderer } from "@/lib/ai/define-tool-renderer";
import { evePlatformOutput } from "@/lib/eve/platform-result";
import {
  codeExecutionInput,
  codeExecutionResult,
} from "@/tools/platform/code-execution.schemas";
import { CodeExecution } from "../part/code-execution";

const CodeExecutionRenderer = defineToolRenderer({
  inputSchema: codeExecutionInput,
  outputSchema: codeExecutionResult,
  render: ({ tool }) => (
    <CodeExecution tool={{ ...tool, type: "tool-codeExecution" }} />
  ),
});

export function EvePlatformToolResult({
  part,
  messageId,
  isReadonly,
}: {
  part: Extract<EveMessagePart, { type: "dynamic-tool" }>;
  messageId: string;
  isReadonly: boolean;
}) {
  if (part.state !== "output-available") {
    return (
      <CodeExecutionRenderer
        isReadonly={isReadonly}
        messageId={messageId}
        tool={part}
      />
    );
  }
  const result = evePlatformOutput.safeParse(part.output);
  if (!result.success) {
    return <p role="alert">This tool result could not be displayed.</p>;
  }
  return (
    <CodeExecutionRenderer
      isReadonly={isReadonly}
      messageId={messageId}
      tool={{ ...part, output: result.data.output }}
    />
  );
}
