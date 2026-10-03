/* oxlint-disable eslint/sort-keys -- Preserve the original serialized MCP result contract used by durable transcripts. */
import { z } from "zod";

/* oxlint-disable unicorn/max-nested-calls --
 * unicorn/max-nested-calls (#568): modelOutput keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
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
/* oxlint-enable unicorn/max-nested-calls */
/* oxlint-disable import/no-named-export, import/prefer-default-export --
 * import/no-named-export (#527): Preserve the named eveMcpResult API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * import/prefer-default-export (#532): eveMcpResult remains a named API, consistent with no-default-export; adding future exports must not change caller import syntax.
 */
export const eveMcpResult = z.object({
  kind: z.literal("chatjs.mcp-result"),
  output: z.json(),
  modelOutput,
});
/* oxlint-enable import/no-named-export, import/prefer-default-export */
