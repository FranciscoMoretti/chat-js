import { z } from "zod";

/* oxlint-disable import/exports-last -- Keep the exported declaration beside the types and initialization it describes; moving it can reorder module initialization. */
/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
export const documentExecutionInput = z.object({
  documentId: z.uuid(),
  revisionId: z.uuid(),
});
/* oxlint-enable import/group-exports */
/* oxlint-enable import/exports-last */

const chartLabels = {
  title: z.string(),
  x_label: z.string().optional(),
  y_label: z.string().optional(),
};
/* oxlint-disable unicorn/max-nested-calls -- Keep this data transformation together so its argument evaluation order and contextual type inference remain explicit. */
const series = z.object({
  label: z.string(),
  points: z.array(z.tuple([z.union([z.number(), z.string()]), z.number()])),
});
/* oxlint-enable unicorn/max-nested-calls */
/* oxlint-disable unicorn/max-nested-calls -- Keep this data transformation together so its argument evaluation order and contextual type inference remain explicit. */
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
/* oxlint-enable unicorn/max-nested-calls */

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable unicorn/max-nested-calls -- Keep this data transformation together so its argument evaluation order and contextual type inference remain explicit. */
/** The saved-code runner owns its output contract independently of installed renderers. */
export const eveCodeExecutionResult = z.object({
  chart: z.union([
    z.string(),
    z.object({ base64: z.string(), format: z.string() }),
    chart,
  ]),
  message: z.string(),
});
/* oxlint-enable unicorn/max-nested-calls */
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
export const documentExecutionLanguage = (
  title: string
): "python" | "javascript" | undefined => {
  const extension = title.includes(".")
    ? title.split(".").at(-1)?.toLowerCase()
    : undefined;
  if (
    !(typeof extension === "string" && extension !== "") ||
    extension === "py"
  ) {
    return "python";
  }
  if (extension === "js" || extension === "mjs" || extension === "cjs") {
    return "javascript";
  }
  return undefined;
};
/* oxlint-enable eslint/no-undefined */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable import/group-exports */
