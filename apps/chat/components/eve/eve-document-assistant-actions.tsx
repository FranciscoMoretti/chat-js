"use client";

import {
  LineChart,
  List,
  MessageSquare,
  Pen,
  Sparkles,
  Square,
} from "lucide-react";
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
/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, no-undefined, react-perf/jsx-no-new-function-as-prop, react/forbid-component-props, react/jsx-max-depth, react/jsx-no-literals, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-void-return, unicorn/no-null -- EveDocumentAssistantActions: ; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 0); no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/jsx-no-literals: these existing labels and accessible text are this feature content; localization is a separate content migration; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including request: DocumentAssistantRequest); typescript/strict-void-return: this library event API ignores the return value while the existing handler owns its async pending and error lifecycle; unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

export const EveDocumentAssistantActions = ({
  kind,
  documentId,
  revisionId,
  disabled,
  onAction,
  busy = false,
  onStop,
}: {
  kind: "text" | "code" | "sheet";
  documentId: string;
  revisionId: string;
  disabled: boolean;
  onAction?: (request: DocumentAssistantRequest) => Promise<void>;
  busy?: boolean;
  onStop?: () => Promise<void>;
}) => {
  const [expanded, setExpanded] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );
  useEffect(() => () => clearTimeout(closeTimer.current), []);
  const actions = documentAssistantActions(kind);
  if (actions.length === 0) {
    return null;
  }
  const open = () => {
    clearTimeout(closeTimer.current);
    setExpanded(true);
  };
  const close = () => {
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

              // oxlint-disable-next-line typescript/no-misused-promises -- #585: The parent owns document action and cancellation promises; preserve that callback contract and pending-state management.
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
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, no-undefined, react-perf/jsx-no-new-function-as-prop, react/forbid-component-props, react/jsx-max-depth, react/jsx-no-literals, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-void-return, unicorn/no-null */
