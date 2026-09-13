import dynamic from "next/dynamic";

import { Card } from "@/components/ui/card";

export type { BaseChart } from "./interactive-chart-impl";

const ChartSkeleton = () => (
  <Card className="border-border bg-card overflow-hidden">
    <div className="flex h-[400px] items-center justify-center p-6">
      <div className="bg-muted size-8 animate-pulse rounded-md" />
    </div>
  </Card>
);

export default dynamic(
  () => import("./interactive-chart-impl").then((m) => m.default),
  {
    loading: () => <ChartSkeleton />,
    ssr: false,
  }
);
