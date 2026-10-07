"use client";

import {
  LineChart,
  List,
  MessageSquare,
  Pen,
  Sparkles,
  Square,
} from "lucide-react";
import type { JSX as ReactJSX } from "react";
import React, { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  documentAssistantActions,
  documentAssistantRequest,
} from "@/lib/eve/document-assistant-actions";
import type { DocumentAssistantRequest } from "@/lib/eve/document-contracts";
/* oxlint-disable typescript/explicit-function-return-type -- helperIcon: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result. */

const helperIcon = (label: string) => {
  switch (label) {
    case "Add final polish": {
      return Pen;
    }
    case "Add comments": {
      return MessageSquare;
    }
    case "Add logs": {
      return List;
    }
    case "Analyze and visualize data": {
      return LineChart;
    }
    default: {
      return Sparkles;
    }
  }
};
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, no-undefined, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, typescript/prefer-readonly-parameter-types, typescript/strict-void-return, unicorn/no-null -- EveDocumentAssistantActions: ; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 0); no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including request: DocumentAssistantRequest); typescript/strict-void-return: this library event API ignores the return value while the existing handler owns its async pending and error lifecycle; unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

export const EveDocumentAssistantActions = ({
  kind,
  documentId,
  revisionId,
  disabled,
  onAction,
  busy = false,
  onStop,
}: {
  readonly kind: "text" | "code" | "sheet";
  readonly documentId: string;
  readonly revisionId: string;
  readonly disabled: boolean;
  readonly onAction?: (request: DocumentAssistantRequest) => Promise<void>;
  readonly busy?: boolean;
  readonly onStop?: () => Promise<void>;
}): ReactJSX.Element | null => {
  const [expanded, setExpanded] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );
  useEffect(() => (): void => clearTimeout(closeTimer.current), []);
  const actions = documentAssistantActions(kind);
  if (actions.length === 0) {
    return null;
  }
  const open = (): void => {
    clearTimeout(closeTimer.current);
    setExpanded(true);
  };
  const close = (): void => {
    closeTimer.current = setTimeout(() => setExpanded(false), 200);
  };
  const [primary, ...secondary] = actions;
  const visible = expanded ? [...secondary, primary] : [primary];
  return (
    <div
      className="bg-background absolute right-6 bottom-6 z-10 flex flex-col gap-1.5 rounded-full border p-1.5 shadow-lg"
      role="toolbar"
      tabIndex={-1}
      aria-label="Document helpers"
      onMouseEnter={open}
      onMouseLeave={close}
      onFocus={open}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          close();
        }
      }}
    >
      {busy && onStop ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              aria-label="Stop generation"
              className="h-auto w-auto rounded-full p-3"
              variant="ghost"

              // oxlint-disable-next-line typescript/no-misused-promises -- #770: Button ignores returns; the supplied cancelExecution callback catches agent.cancel failure into controller.commands.failure and always clears cancelling. Keep the awaitable cancellation API shared with artifact execution.
              onClick={onStop}
            >
              <Square size={16} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">Stop generation</TooltipContent>
        </Tooltip>
      ) : (
        visible.map((action) => {
          const Icon = helperIcon(action.label);
          return (
            <Tooltip key={action.label}>
              <TooltipTrigger asChild>
                <Button
                  disabled={disabled || !onAction}
                  variant="ghost"
                  className="h-auto w-auto rounded-full p-3"
                  aria-label={action.label}

                  onClick={() => {
                    void onAction?.(
                      documentAssistantRequest(action, documentId, revisionId)
                    );
                  }}
                >
                  <Icon size={16} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">{action.label}</TooltipContent>
            </Tooltip>
          );
        })
      )}
    </div>
  );
};
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, no-undefined, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, typescript/prefer-readonly-parameter-types, typescript/strict-void-return, unicorn/no-null */
