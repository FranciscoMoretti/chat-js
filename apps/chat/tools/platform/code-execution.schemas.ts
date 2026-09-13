import { z } from "zod";

import { supportedExecutionLanguages } from "./code-execution.types";

export const codeExecutionInput = z.object({
  title: z.string().describe("The title of the code snippet."),
  language: z
    .enum(supportedExecutionLanguages)
    .default("python")
    .describe("The language to execute: 'python' or 'javascript'."),
  code: z
    .string()
    .describe(
      "The code to execute in the selected sandbox language. Print anything you want to return, or assign to 'result'/'results'."
    ),
});

const common = {
  title: z.string(),
  x_label: z.string().optional(),
  y_label: z.string().optional(),
};
const series = z.object({
  label: z.string(),
  points: z.array(z.tuple([z.union([z.number(), z.string()]), z.number()])),
});
const chart = z.discriminatedUnion("type", [
  z.object({
    ...common,
    type: z.literal("line"),
    x_scale: z
      .literal("datetime")
      .nullish()
      .transform((value) => value ?? undefined),
    elements: z.array(series),
  }),
  z.object({
    ...common,
    type: z.literal("scatter"),
    x_scale: z
      .literal("datetime")
      .nullish()
      .transform((value) => value ?? undefined),
    elements: z.array(series),
  }),
  z.object({
    ...common,
    type: z.literal("bar"),
    elements: z.array(
      z.object({ group: z.string(), label: z.string(), value: z.number() })
    ),
  }),
]);

export const codeExecutionResult = z.object({
  message: z.string(),
  chart: z.union([
    z.string(),
    z.object({ base64: z.string(), format: z.string() }),
    chart,
  ]),
});
