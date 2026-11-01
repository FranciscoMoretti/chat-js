import React from "react";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { ResearchProgress } from "./progress-panel";
import type { ResearchUpdate } from "@/tools/platform/research-updates-schema";

export const ReasonSearchResearchProgress = ({
  updates,
}: ReadonlyNativeSurface<{
  updates: ResearchUpdate[];
}>): React.JSX.Element | null => {
  if (updates.length > 0) {
    return (
      <ResearchProgress
        isComplete={updates.some(
          (update: ReadonlyNativeSurface<ResearchUpdate>) =>
            update.type === "completed"
        )}
        updates={updates}
      />
    );
  }
  return null;
};
