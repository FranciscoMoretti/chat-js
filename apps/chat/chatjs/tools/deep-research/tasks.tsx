import React from "react";
import { CircleCheck, Dot, FileText, Pencil, Sparkles } from "lucide-react";
import { Trace, TraceIcon, TraceLine, TraceTitle } from "@/components/ui/trace";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import type { ResearchUpdate } from "@/tools/platform/research-updates-schema";
import { ResearchTask } from "./task";

const icons = {
  completed: CircleCheck,
  started: Dot,
  thoughts: Sparkles,
  web: FileText,
  writing: Pencil,
};

export const ResearchTasks = ({
  updates,
}: ReadonlyNativeSurface<{ updates: ResearchUpdate[] }>): React.JSX.Element => {
  const occurrences = new Map<string, number>();
  const complete = updates.some((update) => update.type === "completed");
  return (
    <Trace>
      {updates.map((update, index) => {
        const identity = `${update.type}:${update.toolCallId}`;
        const occurrence = occurrences.get(identity) ?? 0;
        occurrences.set(identity, occurrence + 1);
        const running =
          !complete &&
          (update.type === "web"
            ? update.status === "running"
            : index === updates.length - 1);
        const Icon = icons[update.type];
        return (
          <div
            className="group flex min-w-0 flex-col gap-2"
            key={`${identity}:${occurrence}`}
            data-research-step
          >
            <TraceLine status={running ? "running" : undefined}>
              <TraceIcon>
                <Icon />
              </TraceIcon>
              <TraceTitle>{update.title}</TraceTitle>
            </TraceLine>
            <div className="min-w-0 ps-6">
              <ResearchTask update={update} />
            </div>
          </div>
        );
      })}
    </Trace>
  );
};
