"use client";

import {
  LineChart,
  List,
  MessageSquare,
  Pen,
  Sparkles,
  Square,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

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
import type { DocumentAssistantRequest } from "@/lib/eve/document-assistant-actions";

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
                  onClick={() =>
                    onAction?.(
                      documentAssistantRequest(action, documentId, revisionId)
                    )
                  }
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
