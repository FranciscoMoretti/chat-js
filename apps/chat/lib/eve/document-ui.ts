import type { ComponentType } from "react";

import type { DocumentAssistantRequest } from "./document-contracts";
import type { ReadonlyEveMessagePart } from "@/lib/eve/readonly-message-types";

interface DocumentBodyProps {
  readonly inline?: boolean;
  readonly title: string;
  readonly editorProps: {
    readonly content: string;
    readonly currentVersionIndex: number;
    readonly isCurrentVersion: boolean;
    readonly isReadonly?: boolean;
    readonly onSaveContent: (content: string, debounce: boolean) => void;
    readonly status: "streaming" | "idle";
  };
  readonly comparison?: {
    readonly conversationId: string;
    readonly documentId: string;
    readonly previousRevisionId: string;
    readonly content: string;
    readonly version: number;
  };
}

interface DocumentUi {
  readonly Body: ComponentType<DocumentBodyProps>;
  readonly copyContent?: (content: string) => string;
}

type DocumentUiRegistry = Partial<
  Record<"text" | "code" | "sheet", DocumentUi>
>;

interface DocumentRunProps {
  readonly buttonOnly?: boolean;
  readonly resultOnly?: boolean;
  readonly documentId: string;
  readonly revisionId: string;
  readonly title: string;
  readonly kind: "text" | "code" | "sheet";
  readonly messages: readonly {
    readonly id: string;
    readonly role: "assistant" | "user";
    readonly metadata?: unknown;
    readonly parts: readonly ReadonlyEveMessagePart[];
  }[];
  readonly disabled: boolean;
  readonly onAction?: (
    request: DocumentAssistantRequest
  ) => void | Promise<void>;
}
export type {
  DocumentBodyProps,
  DocumentRunProps,
  DocumentUi,
  DocumentUiRegistry,
};
