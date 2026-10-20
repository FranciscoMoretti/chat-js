import { z } from "zod";

const MAX_COPY_BYTES = 8_388_608;
const MAX_COPY_MESSAGES = 10_000;
const MAX_MODEL_ID_LENGTH = 512;
const MIN_LENGTH = 1;
const metadata = z.record(z.string(), z.json());

const text = z.strictObject({ type: z.literal("text"), text: z.string() });
const reasoning = z.strictObject({
  type: z.literal("reasoning"),
  text: z.string(),
});
const file = z.strictObject({
  type: z.literal("file"),
  url: z
    .url()
    .refine(
      (value) => ["https:", "http:", "data:"].includes(new URL(value).protocol),
      "Seed files require a copied HTTP or data URL."
    ),
  existingPath: z.string().startsWith("/").optional(),
  mediaType: z.string().min(MIN_LENGTH),
  filename: z.string().optional(),
  size: z.number().int().nonnegative().optional(),
});
const toolBase = {
  type: z.literal("dynamic-tool"),
  toolName: z.string().min(MIN_LENGTH),
  input: z.json(),
};
const tool = z.discriminatedUnion("state", [
  z.strictObject({
    ...toolBase,
    state: z.literal("output-available"),
    output: z.json(),
    outputType: z.literal("text").optional(),
  }),
  z.strictObject({
    ...toolBase,
    state: z.literal("output-error"),
    errorText: z.string(),
  }),
  z.strictObject({
    ...toolBase,
    state: z.literal("output-denied"),
    reason: z.string().optional(),
  }),
]);

/** Trusted server input, never a browser request body or a runtime checkpoint. */
const eveCopySeedSchema = z.strictObject({
  /** Resolve compact file URLs through the authenticated channel before the first model turn. */
  attachments: z.literal("channel").optional(),
  messages: z
    .array(
      z.discriminatedUnion("role", [
        z.strictObject({
          role: z.literal("user"),
          metadata: metadata.optional(),
          parts: z.array(z.union([text, file])).min(MIN_LENGTH),
        }),
        z.strictObject({
          role: z.literal("assistant"),
          metadata: metadata.optional(),
          modelId: z
            .string()
            .min(MIN_LENGTH)
            .max(MAX_MODEL_ID_LENGTH)
            .optional(),
          parts: z
            .array(
              z.union([
                text,
                reasoning,
                file,
                tool,
                z.strictObject({ type: z.literal("step-start") }),
              ])
            )
            .min(MIN_LENGTH),
        }),
      ])
    )
    .max(MAX_COPY_MESSAGES),
});
export type EveCopySeed = z.infer<typeof eveCopySeedSchema>;

/** Validate and detach the server-prepared copy transcript before journal acceptance.
 * @param {unknown} value Server-prepared transcript, never a browser payload.
 * @returns {EveCopySeed} Bounded settled transcript without runtime capabilities.
 */
export const parseEveCopySeed = (value: unknown): EveCopySeed => {
  const encoded = JSON.stringify(value);
  if (
    encoded === undefined ||
    new TextEncoder().encode(encoded).byteLength > MAX_COPY_BYTES
  ) {
    throw new Error("Copy transcript byte limit exceeded.");
  }
  const seed = eveCopySeedSchema.parse(value);
  for (const message of seed.messages) {
    for (const part of message.parts) {
      if (
        part.type === "dynamic-tool" &&
        part.state === "output-available" &&
        part.outputType === "text" &&
        typeof part.output !== "string"
      ) {
        throw new Error("Text tool output must be a string.");
      }
    }
  }
  return seed;
};

const requiredFile = (part: z.infer<typeof file>) => {
  if (part.existingPath === undefined) {
    throw new Error("Imported attachment has no authorized workspace path.");
  }
  return { ...part, existingPath: part.existingPath };
};

/** Validate the persisted trusted seed at the native boundary, including observed paths. */
export const requireWorkspaceSeedPaths = (seed: EveCopySeed) => ({
  ...seed,
  messages: seed.messages.map((message) => {
    if (message.role === "user") {
      return {
        ...message,
        parts: message.parts.map((part) =>
          part.type === "file" ? requiredFile(part) : part
        ),
      };
    }
    return {
      ...message,
      parts: message.parts.map((part) =>
        part.type === "file" ? requiredFile(part) : part
      ),
    };
  }),
});
