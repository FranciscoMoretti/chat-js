import type { ImageRequestContext } from "./image-request";
import { defineTool } from "eve/tools";
import { generateImageInput } from "./schemas";
import { runImageRequest } from "./image-request";
import { toolResultToModelOutput } from "@/lib/eve/tool-model-output";
import type { z } from "zod";

export const generateImageTool = defineTool({
  description: `Generate an image from a user-provided prompt.

The assistant may make small, neutral adjustments to improve clarity, composition, or technical quality, while strictly preserving the user’s original intent, meaning, and message.

The assistant must not add new subjects, claims, branding, or alter the tone or intent of the prompt.
`,
  execute: async (
    { prompt }: Readonly<z.infer<typeof generateImageInput>>,
    context: Readonly<ImageRequestContext>
  ) => await runImageRequest(prompt, context),
  inputSchema: generateImageInput,
  toModelOutput: toolResultToModelOutput,
});
