import type { EveMessage } from "eve/client";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { ComponentType } from "react";
/* oxlint-enable sort-imports */

import type { DocumentAssistantRequest } from "./document-contracts";

/* oxlint-disable typescript/consistent-type-definitions -- typescript/consistent-type-definitions (#559): DocumentBodyProps preserves its current alias/interface semantics; declaration merging and implicit index-signature assignability differ between those forms. */
type DocumentBodyProps = {
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
/* oxlint-enable typescript/consistent-type-definitions */

/* oxlint-disable typescript/consistent-type-definitions -- typescript/consistent-type-definitions (#559): DocumentUi preserves its current alias/interface semantics; declaration merging and implicit index-signature assignability differ between those forms. */
type DocumentUi = {
  Body: ComponentType<DocumentBodyProps>;
  copyContent?: (content: string) => string;
};
/* oxlint-enable typescript/consistent-type-definitions */

type DocumentUiRegistry = Partial<
  Record<"text" | "code" | "sheet", DocumentUi>
>;

/* oxlint-disable typescript/consistent-type-definitions, typescript/prefer-readonly-parameter-types -- typescript/consistent-type-definitions (#559): DocumentRunProps preserves its current alias/interface semantics; declaration merging and implicit index-signature assignability differ between those forms.
typescript/prefer-readonly-parameter-types (#565): DocumentRunProps accepts request: DocumentAssistantRequest; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
type DocumentRunProps = {
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
/* oxlint-disable import/no-named-export -- Keep the named type bindings (DocumentBodyProps, DocumentRunProps, DocumentUi, DocumentUiRegistry); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable typescript/consistent-type-definitions, typescript/prefer-readonly-parameter-types */
export type {
  DocumentBodyProps,
  DocumentRunProps,
  DocumentUi,
  DocumentUiRegistry,
};
/* oxlint-enable import/no-named-export */
