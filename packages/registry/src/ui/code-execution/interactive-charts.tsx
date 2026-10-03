import dynamic from "next/dynamic";
import React from "react";

import { Card } from "@/components/ui/card";

/* oxlint-disable import/exports-last -- Keep the exported declaration beside the types and initialization it describes; moving it can reorder module initialization. */
export type { BaseChart } from "./interactive-chart-impl";
/* oxlint-enable import/exports-last */

/* oxlint-disable react/only-export-components -- Registry consumers require the colocated render helper or metadata exports; the published module is not solely a Fast Refresh boundary. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */

const ChartSkeleton = () => (
  <Card className="border-border bg-card overflow-hidden">
    <div className="flex h-[400px] items-center justify-center p-6">
      <div className="bg-muted size-8 animate-pulse rounded-md" />
    </div>
  </Card>
);

/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable react/only-export-components */

/* oxlint-disable import/no-default-export -- The framework or tool loader consumes this default export by convention. */
/* oxlint-disable react/only-export-components -- Registry consumers require the colocated render helper or metadata exports; the published module is not solely a Fast Refresh boundary. */
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
/* oxlint-enable react/only-export-components */
/* oxlint-enable import/no-default-export */
