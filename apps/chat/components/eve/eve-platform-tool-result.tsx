"use client";

import type { EveMessagePart } from "eve/client";
import { z } from "zod";
import { defineToolRenderer } from "@/lib/ai/define-tool-renderer";
import { evePlatformOutput } from "@/lib/eve/platform-result";
import {
  codeExecutionInput,
  codeExecutionResult,
} from "@/tools/platform/code-execution.schemas";
import { CodeExecution } from "../part/code-execution";
import { ResearchUpdates } from "../part/message-annotations";
import { Sources } from "../sources";

const CodeExecutionRenderer = defineToolRenderer({
  inputSchema: codeExecutionInput,
  outputSchema: codeExecutionResult,
  render: ({ tool }) => (
    <CodeExecution tool={{ ...tool, type: "tool-codeExecution" }} />
  ),
});

function PendingDocumentRun({
  part,
}: {
  part: Extract<EveMessagePart, { type: "dynamic-tool" }>;
}) {
  if (part.state === "output-error") {
    return <p role="alert">{part.errorText}</p>;
  }
  if (part.state === "output-denied") {
    return <p>Document execution declined.</p>;
  }
  return <p role="status">Running saved code…</p>;
}

export function EvePlatformToolResult({
  part,
  messageId,
  isReadonly,
}: {
  part: Extract<EveMessagePart, { type: "dynamic-tool" }>;
  messageId: string;
  isReadonly: boolean;
}) {
  if (part.toolName === "webSearch") {
    if (part.state === "output-error") {
      return <p role="alert">{part.errorText}</p>;
    }
    if (part.state === "output-denied") {
      return <p>Search declined.</p>;
    }
    if (part.state !== "output-available") {
      return <p role="status">Searching…</p>;
    }
    const result = evePlatformOutput.safeParse(part.output);
    if (!result.success) {
      return <p role="alert">This search result could not be displayed.</p>;
    }
    const status = z
      .object({ error: z.string().optional() })
      .safeParse(result.data.output);
    const sources =
      result.data.updates?.flatMap((update) =>
        update.type === "web" ? (update.results ?? []) : []
      ) ?? [];
    const uniqueSources = [
      ...new Map(sources.map((source) => [source.url, source])).values(),
    ];
    return (
      <div className="space-y-3">
        <ResearchUpdates updates={result.data.updates} />
        {status.success && status.data.error && (
          <p role="alert">{status.data.error}</p>
        )}
        {uniqueSources.length > 0 && <Sources sources={uniqueSources} />}
      </div>
    );
  }
  if (part.state !== "output-available") {
    if (part.toolName === "runCodeDocument") {
      return <PendingDocumentRun part={part} />;
    }
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
      tool={{
        ...part,
        input:
          part.toolName === "runCodeDocument" ? result.data.output : part.input,
        output: result.data.output,
      }}
    />
  );
}
