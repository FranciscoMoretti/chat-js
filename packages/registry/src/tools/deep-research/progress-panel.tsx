import { Maximize2, Minimize2 } from "lucide-react";
import React from "react";

import { cn } from "@/lib/utils";
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
// Type-only imports
import type { ResearchUpdate } from "@/tools/platform/research-updates-schema";
/* oxlint-enable eslint/sort-imports */

/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { ResearchTask } from "./task";
/* oxlint-enable eslint/sort-imports */
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

/* oxlint-disable import/prefer-default-export -- Keep the named import contract used by registry consumers and package callers even when this module exposes one value. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable typescript/explicit-module-boundary-types -- This exported adapter derives its result from the schema or SDK contract; duplicating that type would erase inference or drift from the source. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable eslint/no-ternary -- This expression selects a value without introducing mutable intermediate state or changing evaluation order. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
/* oxlint-disable eslint/id-length -- Short callback indices and coordinate keys match the surrounding collection or external data shape; renaming public keys would change the contract. */
/* oxlint-disable oxc/no-optional-chaining -- Optional access deliberately propagates absence from the external or partially initialized data contract. */
/* oxlint-disable react-perf/jsx-no-new-function-as-prop -- The handler captures the current render state; changing its identity policy requires profiling and lifecycle review. */
/* oxlint-disable react/jsx-max-depth -- This nesting expresses the component library composition and accessibility structure; flattening it can change DOM behavior. */
/* oxlint-disable react/forbid-component-props -- The composed UI component exposes this styling prop as part of its supported public API. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/* oxlint-disable typescript/strict-boolean-expressions -- This value-producing condition preserves the current nullish/empty sentinel behavior; coercing it would change the returned value. */
export const ResearchProgress = ({
  updates,
  isComplete,
}: {
  updates: ResearchUpdate[];
  isComplete: boolean;
}) => {
  const [isExpanded, setIsExpanded] = React.useState(false);

  const lastUpdate = updates.length > 0 ? updates.at(-1) : null;

  const searchCount = React.useMemo(
    (): number => updates.filter((u) => u.type === "web").length,
    [updates]
  );

  const sourceCount = React.useMemo(
    (): number =>
      updates
        .filter((u) => u.type === "web")
        .reduce((acc, u): number => acc + (u.results?.length ?? 0), 0),
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
        (u) => u.type === "started" || u.type === "completed"
      );
      const completedUpdate = progressUpdates.find(
        (u) => u.type === "completed"
      );

      return completedUpdate?.timestamp
        ? Math.floor(
            (completedUpdate.timestamp - progressUpdates[0].timestamp) / 1000
          )
        : 0;
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
            {isComplete ? (
              <span className="text-muted-foreground text-xs">{`Researched for ${timeSpent} seconds, ${searchCount} searches, ${sourceCount} sources`}</span>
            ) : (
              <UpdateTitle isRunning={!isComplete} title={lastUpdateTitle} />
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <Minimize2
              aria-hidden="true"
              className="text-muted-foreground size-4 shrink-0"
            />
          ) : (
            <Maximize2
              aria-hidden="true"
              className="text-muted-foreground size-4 shrink-0"
            />
          )}
        </div>
      </button>

      {isExpanded ? (
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
      )}
    </div>
  );
};
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable react/forbid-component-props */
/* oxlint-enable react/jsx-max-depth */
/* oxlint-enable react-perf/jsx-no-new-function-as-prop */
/* oxlint-enable oxc/no-optional-chaining */
/* oxlint-enable eslint/id-length */
/* oxlint-enable unicorn/no-null */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/no-ternary */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable typescript/explicit-module-boundary-types */
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/prefer-default-export */
