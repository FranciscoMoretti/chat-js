import type { DocumentDefinition } from "./document-definition";
import type {
  DocumentAssistantAction,
  DocumentAssistantRequest,
} from "./document-contracts";
import type { ComponentType } from "react";

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
  readonly definition: DocumentDefinition;
  readonly assistantActions?: () => DocumentAssistantAction[];
  readonly supportsComparison?: boolean;
  readonly copyLabel?: string;
  readonly copySuccessMessage?: string;
  readonly copyIconSize?: number;
  readonly copyButtonClassName?: string;
  readonly Body: ComponentType<DocumentBodyProps>;
  readonly copyContent?: (content: string) => string;
}

type DocumentUiRegistry = Partial<Record<string, DocumentUi>>;

interface DocumentRunProps {
  readonly buttonOnly?: boolean;
  readonly resultOnly?: boolean;
  readonly documentId: string;
  readonly revisionId: string;
  readonly title: string;
  readonly kind: string;
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
