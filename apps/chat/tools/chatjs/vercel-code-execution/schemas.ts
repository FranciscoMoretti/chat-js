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

const encodedChart = z.object({ base64: z.string(), format: z.string() });
const chartRecord = z.record(z.string(), z.json());
const codeExecutionResult = z.object({
  chart: z.union([z.string(), encodedChart, chartRecord]),
  message: z.string(),
});
export { codeExecutionInput, codeExecutionResult };
