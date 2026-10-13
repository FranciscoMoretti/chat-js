import { supportedExecutionLanguages } from "@/tools/chatjs/_shared/code-execution/types";
import { codeExecutionOutputSchema } from "@/lib/eve/code-executor";
import { z } from "zod";

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
const codeExecutionResult = codeExecutionOutputSchema.extend({
  chart: z.union([z.string(), encodedChart, chartRecord]),
});
export { codeExecutionInput, codeExecutionResult };
