import React from "react";

import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import type { ResearchUpdate } from "@/tools/platform/research-updates-schema";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import { ResearchProgress } from "./progress-panel";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (ReasonSearchResearchProgress); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-enable sort-imports */

/* oxlint-disable typescript/explicit-module-boundary-types -- This exported adapter derives its result from the schema or SDK contract; duplicating that type would erase inference or drift from the source. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
export const ReasonSearchResearchProgress = ({
  updates,
}: ReadonlyNativeSurface<{
  updates: ResearchUpdate[];
}>) => {
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
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable typescript/explicit-module-boundary-types */
