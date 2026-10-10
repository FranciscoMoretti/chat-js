"use client";
import type { BaseChart } from "./interactive-charts";
import Image from "next/image";
import InteractiveChart from "./interactive-charts";
import React from "react";
import { z } from "zod";

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
const MIN_PNG_BASE64_LENGTH = 1;
const pngSchema = z.object({
  base64: z.string().min(MIN_PNG_BASE64_LENGTH),
  format: z.literal("png"),
});
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (CodeExecutionChart); the enabled import/no-default-export convention rejects the default-export alternative. */

/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */

export const CodeExecutionChart = ({
  value,
}: {
  readonly value: unknown;
}): React.JSX.Element => {
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

/* oxlint-enable unicorn/no-null */
