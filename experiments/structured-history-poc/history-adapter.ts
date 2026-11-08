import { z } from "zod";
/** PoC adapter for ChatJS's captured, authorized transcript; never a browser payload. */
import type { EveCopySeed } from "../../apps/chat/lib/eve/copy-seed";
import type { EveMessage } from "eve/client";
import type { eveChannel } from "eve/channels/eve";

type EveChannelInput = Parameters<typeof eveChannel>[0];
type Result = Awaited<ReturnType<NonNullable<EveChannelInput["onMessage"]>>>;
export type ImportedHistory = NonNullable<Result["history"]>;
type ImportedPart = NonNullable<ImportedHistory[number]["parts"]>[number];

export const capturedHistory = (
  seed: EveCopySeed,
  ids: readonly string[]
): ImportedHistory => {
  if (ids.length !== seed.messages.length) {
    throw new Error("Captured IDs must match the prefix.");
  }
  return structuredClone(seed).messages.map((message, index) => ({
    id: ids[index],
    role: message.role,
    parts: message.parts.map((part): ImportedPart => {
      // Explicit PoC tradeoff: re-stage owned originals. No old workspace-path guarantee.
      if (part.type === "file") {
        return {
          type: part.type,
          url: part.url,
          mediaType: part.mediaType,
          filename: part.filename,
        };
      }
      return { ...part };
    }),
  }));
};

export const branchHistory = (
  messages: readonly EveMessage[],
  before?: string
): ImportedHistory => {
  const boundary =
    before === undefined
      ? messages.length
      : messages.findIndex((message) => message.id === before);
  if (
    boundary < 0 ||
    (before !== undefined && messages[boundary]?.role !== "user")
  ) {
    throw new Error("Invalid branch boundary.");
  }
  return messages.slice(0, boundary).map((message) => ({
    id: message.metadata?.historyId ?? message.id,
    role: message.role,
    parts: message.parts
      .map((part): ImportedPart => {
        if (part.type === "text") {
          return { type: "text", text: part.text };
        }
        if (part.type === "reasoning") {
          return { type: "reasoning", text: part.text };
        }
        if (part.type === "file" && part.url !== undefined) {
          return {
            type: part.type,
            url: part.url,
            mediaType: part.mediaType,
            filename: part.filename,
          };
        }
        if (part.type === "tool") {
          // Native output is untyped; the validated import contract accepts JSON only.
          if (part.state === "completed") {
            return {
              type: "dynamic-tool" as const,
              toolName: part.name,
              input: z.json().parse(part.input ?? null),
              state: "output-available" as const,
              output: z.json().parse(part.output ?? null),
            };
          }
          if (part.state === "failed") {
            return {
              type: "dynamic-tool" as const,
              toolName: part.name,
              input: z.json().parse(part.input ?? null),
              state: "output-error" as const,
              errorText: part.error?.message ?? "Failed",
            };
          }
          if (part.state === "rejected") {
            return {
              type: "dynamic-tool" as const,
              toolName: part.name,
              input: z.json().parse(part.input ?? null),
              state: "output-denied" as const,
              reason: part.error?.message,
            };
          }
        }
        throw new Error("Only completed history can be copied.");
      })
      .flatMap((part, index): ImportedPart[] => {
        const current = message.parts[index]?.stepIndex;
        const previous = message.parts[index - 1]?.stepIndex;
        return message.role === "assistant" &&
          index > 0 &&
          current !== undefined &&
          current !== previous
          ? [{ type: "step-start" }, part]
          : [part];
      }),
  }));
};
