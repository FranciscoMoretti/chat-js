/* oxlint-disable sort-imports --
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import type { EveMessage } from "eve/client";
import type { ComponentType } from "react";

import type { DocumentAssistantRequest } from "./document-contracts";
/* oxlint-enable sort-imports */

/* oxlint-disable import/group-exports, import/no-named-export, typescript/consistent-type-definitions --
 * import/group-exports (#523): DocumentBodyProps stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named DocumentBodyProps API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * typescript/consistent-type-definitions (#559): DocumentBodyProps preserves its current alias/interface semantics; declaration merging and implicit index-signature assignability differ between those forms.
 */
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
/* oxlint-enable import/group-exports, import/no-named-export, typescript/consistent-type-definitions */

/* oxlint-disable import/group-exports, import/no-named-export, typescript/consistent-type-definitions --
 * import/group-exports (#523): DocumentUi stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named DocumentUi API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * typescript/consistent-type-definitions (#559): DocumentUi preserves its current alias/interface semantics; declaration merging and implicit index-signature assignability differ between those forms.
 */
export type DocumentUi = {
  Body: ComponentType<DocumentBodyProps>;
  copyContent?: (content: string) => string;
};
/* oxlint-enable import/group-exports, import/no-named-export, typescript/consistent-type-definitions */
/* oxlint-disable import/group-exports, import/no-named-export --
 * import/group-exports (#523): DocumentUiRegistry stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named DocumentUiRegistry API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export type DocumentUiRegistry = Partial<
  Record<"text" | "code" | "sheet", DocumentUi>
>;
/* oxlint-enable import/group-exports, import/no-named-export */

/* oxlint-disable import/group-exports, import/no-named-export, typescript/consistent-type-definitions, typescript/prefer-readonly-parameter-types --
 * import/group-exports (#523): DocumentRunProps stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named DocumentRunProps API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * typescript/consistent-type-definitions (#559): DocumentRunProps preserves its current alias/interface semantics; declaration merging and implicit index-signature assignability differ between those forms.
 * typescript/prefer-readonly-parameter-types (#565): DocumentRunProps accepts request: DocumentAssistantRequest; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
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
/* oxlint-enable import/group-exports, import/no-named-export, typescript/consistent-type-definitions, typescript/prefer-readonly-parameter-types */
