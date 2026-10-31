import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleTrigger,
  TraceCollapsibleContent,
  TraceLine,
  TraceTitle,
} from "@/components/ui/trace";
// Type-only imports
import type {
  ResearchUpdate,
  WebSearchUpdate,
} from "@/tools/platform/research-updates-schema";
import React from "react";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { ResearchTask } from "./task";
import { ResearchTasks } from "./tasks";

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
    <Trace>
      <TraceCollapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <TraceCollapsibleTrigger>
          <TraceLine status={isComplete ? undefined : "running"}>
            <TraceTitle>
              {isComplete
                ? `Researched for ${timeSpent} seconds, ${searchCount} searches, ${sourceCount} sources`
                : lastUpdateTitle}
            </TraceTitle>
          </TraceLine>
        </TraceCollapsibleTrigger>
        <TraceCollapsibleContent>
          <ResearchTasks updates={updates} />
        </TraceCollapsibleContent>
      </TraceCollapsible>
      {!isExpanded && lastUpdate && !isComplete && (
        <ResearchTask update={lastUpdate} />
      )}
    </Trace>
  );
};
