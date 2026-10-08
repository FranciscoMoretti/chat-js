/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { ComponentType } from "react";
/* oxlint-enable sort-imports */

/* oxlint-disable sort-imports -- These type-only reader imports extend the existing runtime import groups; preserve module evaluation order and the formatter grouping. */
import type { ReadonlyEveMessagePart } from "@/lib/eve/readonly-message-types";

import type { DocumentAssistantRequest } from "./document-contracts";
/* oxlint-enable sort-imports */

/* oxlint-disable typescript/consistent-type-definitions -- typescript/consistent-type-definitions (#559): DocumentBodyProps preserves its current alias/interface semantics; declaration merging and implicit index-signature assignability differ between those forms. */
type DocumentBodyProps = {
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
};
/* oxlint-enable typescript/consistent-type-definitions */

/* oxlint-disable typescript/consistent-type-definitions -- typescript/consistent-type-definitions (#559): DocumentUi preserves its current alias/interface semantics; declaration merging and implicit index-signature assignability differ between those forms. */
type DocumentUi = {
  readonly Body: ComponentType<DocumentBodyProps>;
  readonly copyContent?: (content: string) => string;
};
/* oxlint-enable typescript/consistent-type-definitions */

type DocumentUiRegistry = Partial<
  Record<"text" | "code" | "sheet", DocumentUi>
>;

/* oxlint-disable typescript/consistent-type-definitions -- typescript/consistent-type-definitions (#559): DocumentRunProps preserves its current alias/interface semantics; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */

type DocumentRunProps = {
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
  readonly onAction?: (request: DocumentAssistantRequest) => Promise<void>;
};
/* oxlint-disable import/no-named-export -- Keep the named type bindings (DocumentBodyProps, DocumentRunProps, DocumentUi, DocumentUiRegistry); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable typescript/consistent-type-definitions */
export type {
  DocumentBodyProps,
  DocumentRunProps,
  DocumentUi,
  DocumentUiRegistry,
};
/* oxlint-enable import/no-named-export */
