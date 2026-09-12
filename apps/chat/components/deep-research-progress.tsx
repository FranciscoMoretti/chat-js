import { useMemo } from "react";

import type { ResearchUpdate } from "@/tools/platform/research-updates-schema";

import { ResearchProgress } from "./research-progress";

interface ReasonSearchResearchProgressProps {
  updates: ResearchUpdate[];
}

export const ReasonSearchResearchProgress = ({
  updates,
}: ReasonSearchResearchProgressProps) => {
  // TODO: This should come from a progress update
  const totalExpectedSteps = 0;

  const isComplete = useMemo(() => {
    const progressUpdate = updates.find((u) => u.type === "completed");
    return Boolean(progressUpdate);
  }, [updates]);

  return (
    <ResearchProgress
      isComplete={isComplete}
      totalExpectedSteps={totalExpectedSteps}
      updates={updates}
    />
  );
};
