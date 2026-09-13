"use client";

import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  type DocumentAssistantRequest,
  documentAssistantActions,
  documentAssistantRequest,
} from "@/lib/eve/document-assistant-actions";

export function EveDocumentAssistantActions({
  kind,
  documentId,
  revisionId,
  disabled,
  onAction,
}: {
  kind: "text" | "code" | "sheet";
  documentId: string;
  revisionId: string;
  disabled: boolean;
  onAction: (request: DocumentAssistantRequest) => Promise<void>;
}) {
  const actions = documentAssistantActions(kind);
  if (actions.length === 0) {
    return null;
  }
  return (
    <div className="shrink-0 border-t px-2 py-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button disabled={disabled} size="sm" variant="outline">
            <Sparkles className="size-4" /> Improve document
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {actions.map((action) => (
            <DropdownMenuItem
              key={action.label}
              onSelect={() => {
                onAction(
                  documentAssistantRequest(action, documentId, revisionId)
                );
              }}
            >
              {action.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
