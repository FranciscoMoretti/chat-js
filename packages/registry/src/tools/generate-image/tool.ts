import { defineTool } from "eve/tools";
import type { z } from "zod";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import { toolResultToModelOutput } from "@/lib/eve/tool-model-output";
/* oxlint-enable sort-imports */

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { runImageRequest } from "./image-request";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { ImageRequestContext } from "./image-request";
/* oxlint-enable sort-imports */
import { generateImageInput } from "./schemas";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (generateImageTool); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve generateImageTool's awaited sequencing and rejected-Promise behavior. */
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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
