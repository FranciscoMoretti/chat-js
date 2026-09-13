/* oxlint-disable eslint/sort-keys -- Preserve the original serialized MCP result contract used by durable transcripts. */
import { z } from "zod";

const modelOutput = z.discriminatedUnion("type", [
  z.object({ type: z.literal("json"), value: z.json() }),
  z.object({ type: z.literal("text"), value: z.string() }),
  z.object({
    type: z.literal("content"),
    value: z.array(
      z.discriminatedUnion("type", [
        z.object({ type: z.literal("text"), text: z.string() }),
        z.object({
          type: z.literal("file"),
          mediaType: z.string(),
          filename: z.string().optional(),
          data: z.object({ type: z.literal("data"), data: z.string() }),
        }),
      ])
    ),
  }),
]);
export const eveMcpResult = z.object({
  kind: z.literal("chatjs.mcp-result"),
  output: z.json(),
  modelOutput,
});
