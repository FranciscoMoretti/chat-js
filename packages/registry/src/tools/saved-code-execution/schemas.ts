import { z } from "zod";

const documentExecutionInput = z.object({
  documentId: z.uuid(),
  revisionId: z.uuid(),
});

const chartLabels = {
  title: z.string(),
  x_label: z.string().optional(),
  y_label: z.string().optional(),
};
const point = z.tuple([z.union([z.number(), z.string()]), z.number()]);
const series = z.object({
  label: z.string(),
  points: z.array(point),
});
const barElement = z.object({
  group: z.string(),
  label: z.string(),
  value: z.number(),
});
const lineChart = z.object({
  ...chartLabels,
  elements: z.array(series),
  type: z.literal("line"),
  x_scale: z.literal("datetime").nullish(),
});
const scatterChart = z.object({
  ...chartLabels,
  elements: z.array(series),
  type: z.literal("scatter"),
  x_scale: z.literal("datetime").nullish(),
});
const barChart = z.object({
  ...chartLabels,
  elements: z.array(barElement),
  type: z.literal("bar"),
});
const chart = z.discriminatedUnion("type", [lineChart, scatterChart, barChart]);
const encodedChart = z.object({ base64: z.string(), format: z.string() });

/** The saved-code runner owns its output contract independently of installed renderers. */
const eveCodeExecutionResult = z.object({
  chart: z.union([z.string(), encodedChart, chart]),
  message: z.string(),
});

const LAST_EXTENSION_INDEX = -1;
const executionLanguageByExtension: ReadonlyMap<
  string,
  "python" | "javascript"
> = new Map([
  ["py", "python"],
  ["js", "javascript"],
  ["mjs", "javascript"],
  ["cjs", "javascript"],
]);
const documentExecutionLanguage = (
  title: string
): "python" | "javascript" | undefined => {
  if (!title.includes(".")) {
    return "python";
  }
  const extension = title.split(".").at(LAST_EXTENSION_INDEX)?.toLowerCase();
  if (!(typeof extension === "string" && extension !== "")) {
    return "python";
  }
  return executionLanguageByExtension.get(extension);
};
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (documentExecutionInput, documentExecutionLanguage, eveCodeExecutionResult); the enabled import/no-default-export convention rejects the default-export alternative. */
export {
  documentExecutionInput,
  documentExecutionLanguage,
  eveCodeExecutionResult,
};
/* oxlint-enable import/no-named-export */
