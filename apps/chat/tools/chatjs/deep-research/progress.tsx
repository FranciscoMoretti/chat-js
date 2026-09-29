import type { ResearchUpdate } from "@/tools/platform/research-updates-schema";

import { ResearchProgress } from "./progress-panel";

export const ReasonSearchResearchProgress = ({
  updates,
}: {
  updates: ResearchUpdate[];
}) =>
  updates.length > 0 ? (
    <ResearchProgress
      isComplete={updates.some((update) => update.type === "completed")}
      updates={updates}
    />
  ) : null;
