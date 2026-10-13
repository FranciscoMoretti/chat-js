import { Card } from "@/components/ui/card";
import React from "react";
import dynamic from "next/dynamic";

const ChartSkeleton = (): React.JSX.Element => (
  <Card className="border-border bg-card overflow-hidden">
    <div className="flex h-[400px] items-center justify-center p-6">
      <div className="bg-muted size-8 animate-pulse rounded-md" />
    </div>
  </Card>
);

export type { BaseChart } from "./interactive-chart-impl";
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
