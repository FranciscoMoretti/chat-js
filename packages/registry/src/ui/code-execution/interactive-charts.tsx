import dynamic from "next/dynamic";

/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { Card } from "@/components/ui/card";
/* oxlint-enable eslint/sort-imports */

/* oxlint-disable import/exports-last -- Keep the exported declaration beside the types and initialization it describes; moving it can reorder module initialization. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
export type { BaseChart } from "./interactive-chart-impl";
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/exports-last */

/* oxlint-disable react/only-export-components -- Registry consumers require the colocated render helper or metadata exports; the published module is not solely a Fast Refresh boundary. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable react/forbid-component-props -- The composed UI component exposes this styling prop as part of its supported public API. */
/* oxlint-disable react/react-in-jsx-scope -- The TypeScript/Next automatic JSX runtime supplies JSX helpers; a legacy React binding is not required for rendering. */
const ChartSkeleton = () => (
  <Card className="border-border bg-card overflow-hidden">
    <div className="flex h-[400px] items-center justify-center p-6">
      <div className="bg-muted size-8 animate-pulse rounded-md" />
    </div>
  </Card>
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/forbid-component-props */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable react/only-export-components */

/* oxlint-disable import/no-default-export -- The framework or tool loader consumes this default export by convention. */
/* oxlint-disable react/only-export-components -- Registry consumers require the colocated render helper or metadata exports; the published module is not solely a Fast Refresh boundary. */
/* oxlint-disable oxc/no-async-await -- Await preserves the existing sequencing, rejection propagation, and cleanup behavior of this asynchronous operation. */
/* oxlint-disable react/react-in-jsx-scope -- The TypeScript/Next automatic JSX runtime supplies JSX helpers; a legacy React binding is not required for rendering. */
export default dynamic(
  async () => {
    const { default: InteractiveChart } =
      await import("./interactive-chart-impl");
    return InteractiveChart;
  },
  {
    loading: () => <ChartSkeleton />,
    ssr: false,
  }
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable react/only-export-components */
/* oxlint-enable import/no-default-export */
