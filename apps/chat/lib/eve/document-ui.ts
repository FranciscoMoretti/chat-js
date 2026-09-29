import type { EveMessage } from "eve/client";
import type { ComponentType } from "react";

import type { DocumentAssistantRequest } from "./document-contracts";

export type DocumentBodyProps = {
  inline?: boolean;
  title: string;
  editorProps: {
    content: string;
    currentVersionIndex: number;
    isCurrentVersion: boolean;
    isReadonly?: boolean;
    onSaveContent: (content: string, debounce: boolean) => void;
    status: "streaming" | "idle";
  };
  comparison?: {
    conversationId: string;
    documentId: string;
    previousRevisionId: string;
    content: string;
    version: number;
  };
};

export type DocumentUi = {
  Body: ComponentType<DocumentBodyProps>;
  copyContent?: (content: string) => string;
};
export type DocumentUiRegistry = Partial<
  Record<"text" | "code" | "sheet", DocumentUi>
>;

export type DocumentRunProps = {
  buttonOnly?: boolean;
  resultOnly?: boolean;
  documentId: string;
  revisionId: string;
  title: string;
  kind: "text" | "code" | "sheet";
  messages: readonly EveMessage[];
  disabled: boolean;
  onAction?: (request: DocumentAssistantRequest) => Promise<void>;
};
