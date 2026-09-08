"use client";

import type { EveMessagePart } from "eve/client";
import { z } from "zod";
import {
  retrievedResult,
  weatherResult,
  wordCountResult,
} from "@/lib/eve/tool-results";
import { GetWeatherRenderer } from "@/tools/chatjs/get-weather/renderer";
import { RetrieveUrlRenderer } from "@/tools/chatjs/retrieve-url/renderer";
import { WordCountRenderer } from "@/tools/chatjs/word-count/renderer";

export function EveToolResult({
  part,
  messageId,
}: {
  part: Extract<EveMessagePart, { type: "dynamic-tool" }>;
  messageId: string;
}) {
  if (part.state !== "output-available") {
    return null;
  }
  const common = { toolCallId: part.toolCallId, state: part.state };
  if (part.toolName === "wordCount") {
    const input = z.object({ text: z.string() }).safeParse(part.input);
    const output = wordCountResult.safeParse(part.output);
    if (output.success && input.success) {
      return (
        <WordCountRenderer
          isReadonly
          messageId={messageId}
          tool={{ ...common, input: input.data, output: output.data }}
        />
      );
    }
  }
  if (part.toolName === "getWeather") {
    const input = z
      .object({ latitude: z.number(), longitude: z.number() })
      .safeParse(part.input);
    const output = weatherResult.safeParse(part.output);
    if (output.success && input.success) {
      return (
        <GetWeatherRenderer
          isReadonly
          messageId={messageId}
          tool={{ ...common, input: input.data, output: output.data }}
        />
      );
    }
  }
  if (part.toolName === "retrieveUrl") {
    const input = z.object({ url: z.string() }).safeParse(part.input);
    const output = retrievedResult.safeParse(part.output);
    if (output.success && input.success) {
      return (
        <RetrieveUrlRenderer
          isReadonly
          messageId={messageId}
          tool={{ ...common, input: input.data, output: output.data }}
        />
      );
    }
  }
  return <p role="alert">This tool result could not be displayed.</p>;
}
