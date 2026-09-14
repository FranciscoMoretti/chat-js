import type { ResearchUpdate } from "@/tools/platform/research-updates-schema";

import { ReasonSearchResearchProgress } from "../deep-research-progress";

export const ResearchUpdates = ({
  updates,
}: {
  updates: ResearchUpdate[] | undefined;
}) => {
  if (!updates || updates.length === 0) {
    return null;
  }
  return <ReasonSearchResearchProgress updates={updates} />;
};
