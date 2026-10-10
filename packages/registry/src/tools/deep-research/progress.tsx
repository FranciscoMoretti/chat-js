import React from "react";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { ResearchProgress } from "./progress-panel";
import type { ResearchUpdate } from "@/tools/platform/research-updates-schema";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (ReasonSearchResearchProgress); the enabled import/no-default-export convention rejects the default-export alternative. */

/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable unicorn/no-null */
/* oxlint-enable eslint/no-magic-numbers */
