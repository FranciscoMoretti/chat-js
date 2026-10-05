import { File, Loader2, Pencil } from "lucide-react";
import React, { memo } from "react";
import type { JSX as ReactJSX } from "react";

import { useDocumentConversation } from "@/components/eve/eve-document-context";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { useArtifact } from "@/hooks/use-artifact";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { ArtifactKind } from "@/lib/artifacts/artifact-kind";
/* oxlint-enable sort-imports */
/* oxlint-disable id-length -- hasProp: id-length: retain conventional event, index, and generic identifiers in this existing callback contract */

const hasProp = <T extends string>(
  obj: unknown,
  prop: T
): obj is Record<T, unknown> =>
  typeof obj === "object" && obj !== null && prop in obj;
/* oxlint-enable id-length */

const isArtifactToolResult = (
  value: unknown
): value is { id: string; title: string; kind: ArtifactKind } =>
  hasProp(value, "id") &&
  typeof value.id === "string" &&
  hasProp(value, "title") &&
  typeof value.title === "string" &&
  hasProp(value, "kind") &&
  typeof value.kind === "string";

/* oxlint-disable typescript/explicit-function-return-type, unicorn/no-null -- getActionText: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

const getActionText = (
  type: "create" | "update" | "read",
  tense: "present" | "past"
) => {
  switch (type) {
    case "read": {
      return tense === "present" ? "Reading" : "Read";
    }
    case "create": {
      return tense === "present" ? "Creating" : "Created";
    }
    case "update": {
      return tense === "present" ? "Updating" : "Updated";
    }
    default: {
      return null;
    }
  }
};
/* oxlint-enable typescript/explicit-function-return-type, unicorn/no-null */

interface DocumentToolResultProps {
  followLive?: boolean;
  disabled?: boolean;
  isReadonly: boolean;
  messageId: string;
  result: {
    id: string;
    title: string;
    kind: ArtifactKind;
    revisionId?: string;
  };
  type: "create" | "update" | "read";
}
/* oxlint-disable no-undefined, typescript/prefer-readonly-parameter-types, unicorn/no-null -- PureDocumentToolResult: no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types; unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

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
/* oxlint-enable no-undefined, typescript/prefer-readonly-parameter-types, unicorn/no-null */

const DocumentToolResult = memo(PureDocumentToolResult);

interface DocumentToolCallProps {
  args: { title?: string };
  isReadonly: boolean;
  type: "create" | "update" | "read";
}
/* oxlint-disable react/jsx-max-depth, react/no-multi-comp, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null -- PureDocumentToolCall: react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including currentArtifact); typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including args.title); unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

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
          {`${getActionText(type, "present")} ${args.title ? `"${args.title}"` : ""}`}
        </div>
      </div>

      <div className="mt-1 animate-spin">
        <Loader2 size={16} />
      </div>
    </button>
  );
};
/* oxlint-enable react/jsx-max-depth, react/no-multi-comp, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null */

const DocumentToolCall = memo(PureDocumentToolCall, () => true);
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (DocumentToolCall, DocumentToolResult, hasProp, isArtifactToolResult); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable react/only-export-components -- #620: Consumers import DocumentToolCall, DocumentToolResult, hasProp, isArtifactToolResult from this existing mixed component, context, or helper API; separating the Fast Refresh boundary remains tracked review debt. */
export { DocumentToolCall, DocumentToolResult, hasProp, isArtifactToolResult };
/* oxlint-enable import/no-named-export */
/* oxlint-enable react/only-export-components */
