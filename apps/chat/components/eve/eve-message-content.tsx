"use client";

import { call, callState, part as contentPart, turn } from "eve/events";
import type { Answer, Interaction, SessionView } from "eve/events";
import { Fragment, useState } from "react";
import type { ReactNode } from "react";

import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceDescription,
  TraceLine,
  TraceTitle,
} from "@/components/ui/trace";
import type { ReadonlyEveMessagePart } from "@/lib/eve/readonly-message-types";
import { EveMessagePart } from "./eve-message-part";
import { EveInteraction } from "./eve-pending-input";

type ActivityPart = Extract<
  ReadonlyEveMessagePart,
  { type: "reasoning" | "tool" }
>;
interface MessagePart<Part = ReadonlyEveMessagePart> {
  readonly key: string;
  readonly part: Part;
}
type MessageBlock =
  | { readonly kind: "activity"; readonly steps: MessagePart<ActivityPart>[] }
  | {
      readonly kind: "part";
      readonly entry: MessagePart;
    };

const messageBlocks = (parts: readonly MessagePart[]): MessageBlock[] => {
  const blocks: MessageBlock[] = [];
  for (const { key, part } of parts) {
    // Published file deliverables stay in the transcript when activity is collapsed.
    const isActivity =
      part.type === "reasoning" ||
      (part.type === "tool" &&
        !(part.name === "attach_workspace_file" && part.state === "completed"));
    if (isActivity) {
      const last = blocks.at(-1);
      if (last?.kind === "activity") {
        last.steps.push({ key, part });
      } else {
        blocks.push({ kind: "activity", steps: [{ key, part }] });
      }
    } else {
      blocks.push({ kind: "part", entry: { key, part } });
    }
  }
  return blocks;
};

const stepState = (part: ActivityPart, view: SessionView | undefined) =>
  part.type === "tool" && view !== undefined
    ? (callState(view, part.callId) ?? part.state)
    : part.state;

const duration = (
  steps: readonly MessagePart<ActivityPart>[],
  view: SessionView | undefined
): string => {
  if (view === undefined) {
    return "";
  }
  const times = steps.flatMap(({ part }) => {
    const observation =
      part.type === "tool"
        ? call(view, part.callId)
        : contentPart(view, part.id ?? "");
    if (observation?.startedAt === undefined) {
      return [];
    }
    return [
      Date.parse(observation.startedAt),
      Date.parse(observation.endedAt ?? observation.startedAt),
    ];
  });
  const seconds = Math.round((Math.max(...times) - Math.min(...times)) / 1000);
  if (!Number.isFinite(seconds) || seconds < 1) {
    return "";
  }
  if (seconds < 60) {
    return ` for ${seconds}s`;
  }
  return ` for ${Math.floor(seconds / 60)}m ${seconds % 60}s`;
};

const ActivityGroup = ({
  steps,
  view,
  children,
}: {
  readonly steps: readonly MessagePart<ActivityPart>[];
  readonly view?: SessionView;
  readonly children: ReactNode;
}): ReactNode => {
  const [open, setOpen] = useState<boolean>();
  if (steps.length === 1) {
    return children;
  }
  const states = steps.map(({ part }) => stepState(part, view));
  const working = states.some(
    (state) =>
      state === "streaming" || state === "running" || state === "requested"
  );
  const waiting = states.some(
    (state) => state === "approval" || state === "blocked"
  );
  const failures = states.filter((state) => state === "failed").length;
  const settledStatus = failures > 0 ? "error" : undefined;
  let title = `Worked${duration(steps, view)}`;
  if (working) {
    title = "Working";
  } else if (waiting) {
    title = "Waiting for you";
  }

  return (
    <Trace>
      <TraceCollapsible
        open={open ?? (working || waiting)}
        onOpenChange={setOpen}
      >
        <TraceCollapsibleTrigger>
          <TraceLine status={working ? "running" : settledStatus}>
            <TraceTitle>{title}</TraceTitle>
            <TraceDescription>
              {failures
                ? `${failures} of ${steps.length} failed`
                : `${steps.length} steps`}
            </TraceDescription>
          </TraceLine>
        </TraceCollapsibleTrigger>
        <TraceCollapsibleContent className="space-y-2">
          {children}
        </TraceCollapsibleContent>
      </TraceCollapsible>
    </Trace>
  );
};

const callInteractions = (
  part: ReadonlyEveMessagePart,
  byCall: ReadonlyMap<string, readonly Interaction[]>
): readonly Interaction[] => {
  if (part.type !== "tool") {
    return [];
  }
  const interactions = byCall.get(part.callId) ?? [];
  const latest = part.interaction;
  if (latest === undefined) {
    return interactions;
  }
  if (
    !interactions.some(
      ({ interactionId }) => interactionId === latest.interactionId
    )
  ) {
    return [...interactions, latest];
  }
  return interactions.map((interaction) =>
    interaction.interactionId === latest.interactionId &&
    interaction.status === "open" &&
    latest.status === "open" &&
    interaction.answer === undefined
      ? latest
      : interaction
  );
};

export const EveMessageContent = ({
  parts,
  messageId,
  isReadonly,
  inputDisabled,
  respond,
  view,
  interactionsByCall,
}: {
  readonly parts: readonly MessagePart[];
  readonly messageId: string;
  readonly isReadonly: boolean;
  readonly inputDisabled: boolean;
  readonly respond: (response: Answer) => void;
  readonly view?: SessionView;
  readonly interactionsByCall: ReadonlyMap<string, readonly Interaction[]>;
}) => {
  const renderInteraction = (interaction: Interaction, key: string) => (
    <EveInteraction
      key={key}
      interaction={interaction}
      disabled={
        inputDisabled ||
        (view !== undefined &&
          turn(view, interaction.turnId)?.outcome === "cancelled")
      }
      respond={respond}
    />
  );
  return messageBlocks(parts).map((block) => {
    if (block.kind === "part") {
      const { key, part } = block.entry;
      return part.type === "interaction" ? (
        renderInteraction(part, key)
      ) : (
        <Fragment key={key}>
          <EveMessagePart
            messageId={messageId}
            isReadonly={isReadonly}
            part={part}
          />
          {callInteractions(part, interactionsByCall).map((interaction) =>
            renderInteraction(interaction, interaction.interactionId)
          )}
        </Fragment>
      );
    }

    const { steps } = block;
    return (
      <Fragment key={steps[0]?.key}>
        <ActivityGroup steps={steps} view={view}>
          {steps.map(({ key, part }) => (
            <EveMessagePart
              key={key}
              messageId={messageId}
              isReadonly={isReadonly}
              part={part}
              compact={steps.length > 1}
            />
          ))}
        </ActivityGroup>
        {steps
          .flatMap(({ part }) => callInteractions(part, interactionsByCall))
          .map((interaction) =>
            renderInteraction(interaction, interaction.interactionId)
          )}
      </Fragment>
    );
  });
};
