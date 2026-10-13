import { Maximize2, Minimize2 } from "lucide-react";
// Type-only imports
import type {
  ResearchUpdate,
  WebSearchUpdate,
} from "@/tools/platform/research-updates-schema";
import React from "react";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { ResearchTask } from "./task";
import { ResearchTasks } from "./tasks";
import { UpdateTitle } from "./update-title";
import { cn } from "@/lib/utils";

// Add the updateName mapping (consider moving to a shared util later)
const updateName = {
  completed: "Completed",
  started: "Started",
  thoughts: "Thoughts",
  web: "Web Search",
  writing: "Writing",
} as const;

export const ResearchProgress = ({
  updates,
  isComplete,
}: ReadonlyNativeSurface<{
  updates: ResearchUpdate[];
  isComplete: boolean;
}>): React.JSX.Element => {
  const [isExpanded, setIsExpanded] = React.useState(false);

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
          ): number => acc + (update.results?.length ?? 0),
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

      if (
        completedUpdate !== undefined &&
        completedUpdate.timestamp !== 0 &&
        !Number.isNaN(completedUpdate.timestamp)
      ) {
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
        onClick={(): void => {
          setIsExpanded(!isExpanded);
        }}
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
