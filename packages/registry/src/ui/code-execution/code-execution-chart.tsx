"use client";

import Image from "next/image";
import { z } from "zod";

/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import InteractiveChart from "./interactive-charts";
/* oxlint-enable eslint/sort-imports */
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import type { BaseChart } from "./interactive-charts";
/* oxlint-enable eslint/sort-imports */

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
/* oxlint-disable oxc/no-rest-spread-properties -- Copying these properties preserves immutable updates and the existing structural API without mutating the source object. */
/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
/* oxlint-disable unicorn/max-nested-calls -- Keep this data transformation together so its argument evaluation order and contextual type inference remain explicit. */
const chartSchema = z.discriminatedUnion("type", [
  z.object({
    ...chartLabels,
    elements: series,
    type: z.literal("line"),
    x_scale: z
      .literal("datetime")
      .nullish()
      .transform((value) => value ?? undefined),
  }),
  z.object({
    ...chartLabels,
    elements: series,
    type: z.literal("scatter"),
    x_scale: z
      .literal("datetime")
      .nullish()
      .transform((value) => value ?? undefined),
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
/* oxlint-enable eslint/no-undefined */
/* oxlint-enable oxc/no-rest-spread-properties */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
const pngSchema = z.object({
  base64: z.string().min(1),
  format: z.literal("png"),
});
/* oxlint-enable eslint/no-magic-numbers */

/* oxlint-disable import/prefer-default-export -- Keep the named import contract used by registry consumers and package callers even when this module exposes one value. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable typescript/explicit-module-boundary-types -- This exported adapter derives its result from the schema or SDK contract; duplicating that type would erase inference or drift from the source. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable eslint/no-ternary -- This expression selects a value without introducing mutable intermediate state or changing evaluation order. */
/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
/* oxlint-disable react/react-in-jsx-scope -- The TypeScript/Next automatic JSX runtime supplies JSX helpers; a legacy React binding is not required for rendering. */
/* oxlint-disable react/forbid-component-props -- The composed UI component exposes this styling prop as part of its supported public API. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
export const CodeExecutionChart = ({ value }: { value: unknown }) => {
  const parsedChart = chartSchema.safeParse(value);
  const chart: BaseChart | null = parsedChart.success ? parsedChart.data : null;
  const parsedPng = pngSchema.safeParse(value);
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable react/forbid-component-props */
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable unicorn/no-null */
/* oxlint-enable eslint/no-ternary */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable typescript/explicit-module-boundary-types */
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/prefer-default-export */
