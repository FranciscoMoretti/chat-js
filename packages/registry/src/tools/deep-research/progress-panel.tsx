import { Maximize2, Minimize2 } from "lucide-react";
import React from "react";

import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { cn } from "@/lib/utils";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
// Type-only imports
import type {
  ResearchUpdate,
  WebSearchUpdate,
} from "@/tools/platform/research-updates-schema";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import { ResearchTask } from "./task";
/* oxlint-enable sort-imports */
import { ResearchTasks } from "./tasks";
import { UpdateTitle } from "./update-title";

// Add the updateName mapping (consider moving to a shared util later)
const updateName = {
  completed: "Completed",
  started: "Started",
  thoughts: "Thoughts",
  web: "Web Search",
  writing: "Writing",
} as const;

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (ResearchProgress); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-disable typescript/explicit-module-boundary-types -- This exported adapter derives its result from the schema or SDK contract; duplicating that type would erase inference or drift from the source. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */

/* oxlint-disable react/jsx-max-depth -- This nesting expresses the component library composition and accessibility structure; flattening it can change DOM behavior. */

/* oxlint-disable typescript/strict-boolean-expressions -- This value-producing condition preserves the current nullish/empty sentinel behavior; coercing it would change the returned value. */
export const ResearchProgress = ({
  updates,
  isComplete,
}: ReadonlyNativeSurface<{
  updates: ResearchUpdate[];
  isComplete: boolean;
}>) => {
  const [isExpanded, setIsExpanded] = React.useState(false);

  // oxlint-disable-next-line no-ternary -- Keep lastUpdate as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
  const lastUpdate = updates.length > 0 ? updates.at(-1) : null;

  const searchCount = React.useMemo(
    (): number =>
      updates.filter(
        (update: ReadonlyNativeSurface<ResearchUpdate>) => update.type === "web"
      ).length,
    [updates]
  );

  const sourceCount = React.useMemo(
    (): number =>
      updates
        .filter(
          (update: ReadonlyNativeSurface<ResearchUpdate>) =>
            update.type === "web"
        )
        .reduce(
          (
            acc: number,
            update: ReadonlyNativeSurface<WebSearchUpdate>
          ): number =>
            // oxlint-disable-next-line oxc/no-optional-chaining -- Preserve the source.results nullish check and 0 fallback while counting references.
            acc + (update.results?.length ?? 0),
          0
        ),
    [updates]
  );

  // Keep the fallback title while no update has been received.
  const lastUpdateTitle = ((): string => {
    if (!lastUpdate) {
      return "Researching";
    }
    if (isComplete) {
      return "Research Complete";
    }
    return lastUpdate.title || updateName[lastUpdate.type];
  })();

  const timeSpent = React.useMemo((): number => {
    if (isComplete) {
      const progressUpdates = updates.filter(
        (update: ReadonlyNativeSurface<ResearchUpdate>) =>
          update.type === "started" || update.type === "completed"
      );
      const completedUpdate = progressUpdates.find(
        (update: ReadonlyNativeSurface<ResearchUpdate>) =>
          update.type === "completed"
      );

      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading timestamp from completedUpdate; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
      if (completedUpdate?.timestamp) {
        return Math.floor(
          (completedUpdate.timestamp - progressUpdates[0].timestamp) / 1000
        );
      }
      return 0;
    }
    return 0;
  }, [updates, isComplete]);

  return (
    <div className="w-full rounded-lg border p-1">
      <button
        className={cn(
          "flex w-full cursor-pointer items-center justify-between rounded-lg px-3 py-2",
          "hover:bg-accent hover:text-accent-foreground transition-colors"
        )}
        onClick={(): void => setIsExpanded(!isExpanded)}
        type="button"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {
              // oxlint-disable-next-line no-ternary -- Keep JSX child as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
              isComplete ? (
                <span className="text-muted-foreground text-xs">{`Researched for ${timeSpent} seconds, ${searchCount} searches, ${sourceCount} sources`}</span>
              ) : (
                <UpdateTitle isRunning={!isComplete} title={lastUpdateTitle} />
              )
            }
          </div>
        </div>
        <div className="flex items-center gap-2">
          {
            // oxlint-disable-next-line no-ternary -- Keep JSX child as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
            isExpanded ? (
              <Minimize2
                aria-hidden="true"
                // oxlint-disable-next-line react/forbid-component-props -- Minimize2 accepts className in its styling contract; preserve this caller's layout and appearance.
                className="text-muted-foreground size-4 shrink-0"
              />
            ) : (
              <Maximize2
                aria-hidden="true"
                // oxlint-disable-next-line react/forbid-component-props -- Maximize2 accepts className in its styling contract; preserve this caller's layout and appearance.
                className="text-muted-foreground size-4 shrink-0"
              />
            )
          }
        </div>
      </button>

      {
        // oxlint-disable-next-line no-ternary -- Keep JSX child as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
        isExpanded ? (
          <div className="px-1 pt-2 pb-1">
            <ResearchTasks updates={updates} />
          </div>
        ) : (
          lastUpdate &&
          !isComplete && (
            <div className="px-4 pt-1 pb-3">
              {/* We only show the running step in this component */}
              <ResearchTask isRunning minimal update={lastUpdate} />
            </div>
          )
        )
      }
    </div>
  );
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable typescript/strict-boolean-expressions */

/* oxlint-enable react/jsx-max-depth */

/* oxlint-enable unicorn/no-null */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable typescript/explicit-module-boundary-types */
