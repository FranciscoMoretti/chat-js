import { z } from "zod";

import { supportedExecutionLanguages } from "./types";

export const codeExecutionInput = z.object({
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

export const codeExecutionResult = z.object({
  chart: z.union([
    z.string(),
    z.object({ base64: z.string(), format: z.string() }),
    z.record(z.string(), z.unknown()),
  ]),
  message: z.string(),
});
