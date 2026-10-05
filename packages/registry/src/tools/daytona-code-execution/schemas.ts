import { z } from "zod";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { supportedExecutionLanguages } from "@/tools/chatjs/_shared/code-execution/types";
/* oxlint-enable sort-imports */

const codeExecutionInput = z.object({
  code: z
    .string()
    .describe(
      "The code to execute in the selected sandbox language. Print anything you want to return, or assign to 'result'/'results'."
    ),
  language: z
    .enum(supportedExecutionLanguages)
    .default("python")
    .describe("The language to execute: 'python' or 'javascript'."),
  title: z.string().describe("The title of the code snippet."),
});

/* oxlint-disable unicorn/max-nested-calls -- Keep this data transformation together so its argument evaluation order and contextual type inference remain explicit. */
const codeExecutionResult = z.object({
  chart: z.union([
    z.string(),
    z.object({ base64: z.string(), format: z.string() }),
    z.record(z.string(), z.json()),
  ]),
  message: z.string(),
});
/* oxlint-enable unicorn/max-nested-calls */
export { codeExecutionInput, codeExecutionResult };
