"use client";

import type { EveMessagePart } from "eve/client";
import { z } from "zod";

import { eveCodeExecutionResult } from "@/lib/eve/document-execution-contracts";
import { evePlatformOutput } from "@/lib/eve/platform-result";

import { ResearchUpdates } from "../part/message-annotations";
import { Sources } from "../sources";
import { EveResearchResult } from "./eve-research-result";

const PlatformToolResult = ({
  part,
}: {
  part: Extract<EveMessagePart, { type: "dynamic-tool" }>;
}) => {
  if (part.state === "output-error") {
    return <p role="alert">{part.errorText}</p>;
  }
  if (part.state === "output-denied") {
    return <p>This tool request was declined.</p>;
  }
  if (part.state !== "output-available") {
    return <output>Running {part.toolName}…</output>;
  }
  const envelope = evePlatformOutput.safeParse(part.output);
  if (!envelope.success) {
    return <p role="alert">This tool result could not be displayed.</p>;
  }
  return (
    <pre className="bg-muted overflow-x-auto rounded-md p-3 text-xs">
      {JSON.stringify(envelope.data.output, null, 2)}
    </pre>
  );
};

const PendingDocumentRun = ({
  part,
}: {
  part: Extract<EveMessagePart, { type: "dynamic-tool" }>;
}) => {
  if (part.state === "output-error") {
    return <p role="alert">{part.errorText}</p>;
  }
  if (part.state === "output-denied") {
    return <p>Document execution declined.</p>;
  }
  return <output>Running saved code…</output>;
};

export const EvePlatformToolResult = ({
  part,
  messageId,
  isReadonly,
}: {
  part: Extract<EveMessagePart, { type: "dynamic-tool" }>;
  messageId: string;
  isReadonly: boolean;
}) => {
  if (part.toolName === "deepResearch") {
    return (
      <EveResearchResult
        isReadonly={isReadonly}
        messageId={messageId}
        part={part}
      />
    );
  }
  if (part.toolName === "generateVideo" || part.toolName === "generateImage") {
    return <PlatformToolResult part={part} />;
  }
  if (part.toolName === "webSearch") {
    if (part.state === "output-error") {
      return <p role="alert">{part.errorText}</p>;
    }
    if (part.state === "output-denied") {
      return <p>Search declined.</p>;
    }
    if (part.state !== "output-available") {
      return <output>Searching…</output>;
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
    return <PlatformToolResult part={part} />;
  }
  const result = evePlatformOutput.safeParse(part.output);
  if (!result.success) {
    return <p role="alert">This tool result could not be displayed.</p>;
  }
  if (part.toolName === "runCodeDocument") {
    const documentResult = eveCodeExecutionResult.safeParse(result.data.output);
    return documentResult.success ? (
      <p>{documentResult.data.message}</p>
    ) : (
      <p role="alert">This saved-code result could not be displayed.</p>
    );
  }
  return <PlatformToolResult part={part} />;
};
