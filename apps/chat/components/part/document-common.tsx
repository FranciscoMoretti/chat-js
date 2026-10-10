import { File, Loader2, Pencil } from "lucide-react";
import React, { memo } from "react";
import type { ArtifactKind } from "@/lib/artifacts/artifact-kind";

import type { JSX as ReactJSX } from "react";

import { useArtifact } from "@/hooks/use-artifact";

import { useDocumentConversation } from "@/components/eve/eve-document-context";

const hasProp = <Key extends string>(
  obj: unknown,
  prop: Key
): obj is Record<Key, unknown> =>
  typeof obj === "object" && obj !== null && prop in obj;

const isArtifactToolResult = (
  value: unknown
): value is { id: string; title: string; kind: ArtifactKind } =>
  hasProp(value, "id") &&
  typeof value.id === "string" &&
  hasProp(value, "title") &&
  typeof value.title === "string" &&
  hasProp(value, "kind") &&
  typeof value.kind === "string";

type DocumentActionText =
  | "Reading"
  | "Read"
  | "Creating"
  | "Created"
  | "Updating"
  | "Updated";

const actionTextByType: ReadonlyMap<
  "create" | "update" | "read",
  { readonly past: DocumentActionText; readonly present: DocumentActionText }
> = new Map([
  ["read", { past: "Read", present: "Reading" }],
  ["create", { past: "Created", present: "Creating" }],
  ["update", { past: "Updated", present: "Updating" }],
]);
/* oxlint-disable unicorn/no-null -- Unknown document action kinds retain the existing empty-label sentinel. */
const getActionText = (
  type: "create" | "update" | "read",
  tense: "present" | "past"
): DocumentActionText | null => {
  const labels = actionTextByType.get(type);
  if (!labels) {
    return null;
  }
  if (tense === "present") {
    return labels.present;
  }
  return labels.past;
};
/* oxlint-enable unicorn/no-null */

interface DocumentToolResultProps {
  readonly followLive?: boolean;
  readonly disabled?: boolean;
  readonly isReadonly: boolean;
  readonly messageId: string;
  readonly result: {
    readonly id: string;
    readonly title: string;
    readonly kind: ArtifactKind;
    readonly revisionId?: string;
  };
  readonly type: "create" | "update" | "read";
}
/* oxlint-disable no-undefined, unicorn/no-null -- PureDocumentToolResult: no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

const PureDocumentToolResult = ({
  disabled = false,
  followLive = false,
  type,
  result,
  isReadonly: _isReadonly,
  messageId,
}: DocumentToolResultProps): ReactJSX.Element => {
  const { setArtifact } = useArtifact();
  const conversationId = useDocumentConversation();

  return (
    <button
      className="bg-background flex w-fit cursor-pointer flex-row items-center gap-3 rounded-xl border px-3 py-2"
      disabled={disabled}
      onClick={() => {
        setArtifact({
          content: "",
          conversationId,
          documentId: result.id,
          followLive,
          isVisible: true,
          kind: result.kind,
          messageId,
          // oxlint-disable-next-line no-ternary -- Keep revisionId as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
          revisionId: followLive ? undefined : result.revisionId,
          status: "idle",
          title: result.title,
        });
      }}
      type="button"
    >
      <div className="text-muted-foreground">
        {((): ReactJSX.Element | null => {
          if (type === "create" || type === "read") {
            return <File size={16} />;
          }
          if (type === "update") {
            return <Pencil size={16} />;
          }
          return null;
        })()}
      </div>
      <div className="text-left">
        {`${getActionText(type, "past")} "${result.title}"`}
      </div>
    </button>
  );
};
/* oxlint-enable no-undefined, unicorn/no-null */

const DocumentToolResult = memo(PureDocumentToolResult);

interface DocumentToolCallProps {
  readonly args: { readonly title?: string };
  readonly isReadonly: boolean;
  readonly type: "create" | "update" | "read";
}
/* oxlint-disable react/jsx-max-depth, react/no-multi-comp, unicorn/no-null -- PureDocumentToolCall: react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

const PureDocumentToolCall = ({
  type,
  args,
  isReadonly: _isReadonly,
}: DocumentToolCallProps): ReactJSX.Element => {
  const { setArtifact } = useArtifact();

  return (
    <button
      className="cursor pointer flex w-fit flex-row items-start justify-between gap-3 rounded-xl border px-3 py-2"
      onClick={() => {
        setArtifact((currentArtifact) => ({
          // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing currentArtifact own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
          ...currentArtifact,
          isVisible: true,
        }));
      }}
      type="button"
    >
      <div className="flex flex-row items-start gap-3">
        <div className="text-muted-foreground mt-1">
          {((): ReactJSX.Element | null => {
            if (type === "create" || type === "read") {
              return <File size={16} />;
            }
            if (type === "update") {
              return <Pencil size={16} />;
            }
            return null;
          })()}
        </div>

        <div className="text-left">
          {`${getActionText(type, "present")} ${/* oxlint-disable typescript/strict-boolean-expressions -- Empty or missing titles deliberately omit the optional label suffix. */ /* oxlint-disable no-ternary -- Keep template interpolation as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary. */ args /* oxlint-enable no-ternary */.title /* oxlint-enable typescript/strict-boolean-expressions */ ? `"${args.title}"` : ""}`}
        </div>
      </div>

      <div className="mt-1 animate-spin">
        <Loader2 size={16} />
      </div>
    </button>
  );
};
/* oxlint-enable react/jsx-max-depth, react/no-multi-comp, unicorn/no-null */

const DocumentToolCall = memo(PureDocumentToolCall, () => true);
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (DocumentToolCall, DocumentToolResult, hasProp, isArtifactToolResult); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable react/only-export-components -- #620: Consumers import DocumentToolCall, DocumentToolResult, hasProp, isArtifactToolResult from this existing mixed component, context, or helper API; separating the Fast Refresh boundary remains tracked review debt. */
export { DocumentToolCall, DocumentToolResult, hasProp, isArtifactToolResult };
/* oxlint-enable import/no-named-export */
/* oxlint-enable react/only-export-components */
