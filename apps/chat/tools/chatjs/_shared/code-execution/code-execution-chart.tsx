"use client";
import Image from "next/image";
import React from "react";
import { z } from "zod";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { BaseChart } from "./interactive-charts";
/* oxlint-enable sort-imports */
import InteractiveChart from "./interactive-charts";

const chartLabels = {
  title: z.string().default(""),
  x_label: z.string().optional(),
  y_label: z.string().optional(),
};
/* oxlint-disable unicorn/max-nested-calls -- Keep this data transformation together so its argument evaluation order and contextual type inference remain explicit. */
const series = z.array(
  z.object({
    label: z.string(),
    points: z.array(z.tuple([z.union([z.number(), z.string()]), z.number()])),
  })
);
/* oxlint-enable unicorn/max-nested-calls */
/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
/* oxlint-disable unicorn/max-nested-calls -- Keep this data transformation together so its argument evaluation order and contextual type inference remain explicit. */
const chartSchema = z.discriminatedUnion("type", [
  z.object({
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing chartLabels own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    ...chartLabels,
    elements: series,
    type: z.literal("line"),
    x_scale: z
      .literal("datetime")
      .nullish()
      .transform((value) => value ?? undefined),
  }),
  z.object({
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing chartLabels own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    ...chartLabels,
    elements: series,
    type: z.literal("scatter"),
    x_scale: z
      .literal("datetime")
      .nullish()
      .transform((value) => value ?? undefined),
  }),
  z.object({
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing chartLabels own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    ...chartLabels,
    elements: z.array(
      z.object({ group: z.string(), label: z.string(), value: z.number() })
    ),
    type: z.literal("bar"),
  }),
]);
/* oxlint-enable unicorn/max-nested-calls */
/* oxlint-enable eslint/no-undefined */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
const pngSchema = z.object({
  base64: z.string().min(1),
  format: z.literal("png"),
});
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (CodeExecutionChart); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-enable eslint/no-magic-numbers */

/* oxlint-disable typescript/explicit-module-boundary-types -- This exported adapter derives its result from the schema or SDK contract; duplicating that type would erase inference or drift from the source. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
export const CodeExecutionChart = ({ value }: { value: unknown }) => {
  const parsedChart = chartSchema.safeParse(value);
  // oxlint-disable-next-line no-ternary -- Keep chart as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
  const chart: BaseChart | null = parsedChart.success ? parsedChart.data : null;
  const parsedPng = pngSchema.safeParse(value);
  // oxlint-disable-next-line no-ternary -- Keep pngChart as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
  const pngChart = parsedPng.success ? parsedPng.data : null;
  return (
    <>
      {chart && (
        <div className="pt-1">
          <InteractiveChart chart={chart} />
        </div>
      )}

      {pngChart && (
        <div className="relative aspect-[4/3] w-full">
          <Image
            alt="Chart output"
            // oxlint-disable-next-line react/forbid-component-props -- Image accepts className in its styling contract; preserve this caller's layout and appearance.
            className="rounded-lg object-contain"
            fill
            sizes="(max-width: 768px) 100vw, 768px"
            src={`data:image/png;base64,${pngChart.base64}`}
            unoptimized
          />
        </div>
      )}
    </>
  );
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-enable unicorn/no-null */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable typescript/explicit-module-boundary-types */
