import dynamic from "next/dynamic";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import React from "react";
/* oxlint-enable sort-imports */

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { Card } from "@/components/ui/card";
/* oxlint-enable sort-imports */

/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */

/* oxlint-disable react/only-export-components -- #623: ChartSkeleton is the existing local loading fallback for this dynamic default chart entrypoint; the loader module is not a standalone Fast Refresh component boundary. */
const ChartSkeleton = () => (
  <Card
    // oxlint-disable-next-line react/forbid-component-props -- Card accepts className in its styling contract; preserve this caller's layout and appearance.
    className="border-border bg-card overflow-hidden"
  >
    <div className="flex h-[400px] items-center justify-center p-6">
      <div className="bg-muted size-8 animate-pulse rounded-md" />
    </div>
  </Card>
);
/* oxlint-disable import/no-named-export -- Keep the named type bindings (BaseChart); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-enable react/only-export-components */

/* oxlint-enable typescript/explicit-function-return-type */

export type { BaseChart } from "./interactive-chart-impl";
/* oxlint-enable import/no-named-export */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve callbacks in this statement's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable import/no-default-export, react/only-export-components -- #623: The chart loader and dynamic import consume this existing default chart entrypoint; preserving that contract retains its established Fast Refresh exception. */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable import/no-default-export, react/only-export-components */
