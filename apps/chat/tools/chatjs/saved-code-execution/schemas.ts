import { z } from "zod";

export const documentExecutionInput = z.object({
  documentId: z.uuid(),
  revisionId: z.uuid(),
});

const chartLabels = {
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
    ...chartLabels,
    elements: z.array(series),
    type: z.literal("line"),
    x_scale: z.literal("datetime").nullish(),
  }),
  z.object({
    ...chartLabels,
    elements: z.array(series),
    type: z.literal("scatter"),
    x_scale: z.literal("datetime").nullish(),
  }),
  z.object({
    ...chartLabels,
    elements: z.array(
      z.object({ group: z.string(), label: z.string(), value: z.number() })
    ),
    type: z.literal("bar"),
  }),
]);

/** The saved-code runner owns its output contract independently of installed renderers. */
export const eveCodeExecutionResult = z.object({
  chart: z.union([
    z.string(),
    z.object({ base64: z.string(), format: z.string() }),
    chart,
  ]),
  message: z.string(),
});

export const documentExecutionLanguage = (
  title: string
): "python" | "javascript" | undefined => {
  const extension = title.includes(".")
    ? title.split(".").at(-1)?.toLowerCase()
    : undefined;
  if (!extension || extension === "py") {
    return "python";
  }
  if (extension === "js" || extension === "mjs" || extension === "cjs") {
    return "javascript";
  }
  return undefined;
};
