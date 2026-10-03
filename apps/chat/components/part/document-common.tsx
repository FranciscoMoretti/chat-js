/* oxlint-disable sort-imports -- Oxfmt owns this module's external, type-only, and alias import groups; its case-insensitive order conflicts with this declaration-order rule. */

import { File, Loader2, Pencil } from "lucide-react";
import React, { memo } from "react";

import { useDocumentConversation } from "@/components/eve/eve-document-context";
import { useArtifact } from "@/hooks/use-artifact";
import type { ArtifactKind } from "@/lib/artifacts/artifact-kind";
/* oxlint-enable sort-imports */
/* oxlint-disable id-length, import/exports-last, import/group-exports, import/no-named-export, react/only-export-components -- hasProp: id-length: retain conventional event, index, and generic identifiers in this existing callback contract; import/exports-last: keep this public declaration beside its implementation so its props and behavior remain reviewable together; import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; import/no-named-export: existing callers import this public component, type, or hook by name; react/only-export-components: consumers also import the associated type, variants, or helper from this established module API. */

export const hasProp = <T extends string>(
  obj: unknown,
  prop: T
): obj is Record<T, unknown> =>
  typeof obj === "object" && obj !== null && prop in obj;
/* oxlint-enable id-length, import/exports-last, import/group-exports, import/no-named-export, react/only-export-components */

/* oxlint-disable id-length, import/exports-last, import/group-exports, import/no-named-export, react/only-export-components -- isArtifactToolResult: id-length: retain conventional event, index, and generic identifiers in this existing callback contract; import/exports-last: keep this public declaration beside its implementation so its props and behavior remain reviewable together; import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; import/no-named-export: existing callers import this public component, type, or hook by name; react/only-export-components: consumers also import the associated type, variants, or helper from this established module API. */

export const isArtifactToolResult = (
  o: unknown
): o is { id: string; title: string; kind: ArtifactKind } =>
  hasProp(o, "id") &&
  typeof o.id === "string" &&
  hasProp(o, "title") &&
  typeof o.title === "string" &&
  hasProp(o, "kind") &&
  typeof o.kind === "string";
/* oxlint-enable id-length, import/exports-last, import/group-exports, import/no-named-export, react/only-export-components */

/* oxlint-disable no-ternary, typescript/explicit-function-return-type, unicorn/no-null -- getActionText: no-ternary: derive the existing render or state alternative inline without introducing another mutable state variable (including tense === "present" ? "Reading" : "Read"); typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

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
/* oxlint-enable no-ternary, typescript/explicit-function-return-type, unicorn/no-null */

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
/* oxlint-disable no-ternary, no-undefined, react-perf/jsx-no-new-function-as-prop, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, unicorn/no-null -- PureDocumentToolResult: no-ternary: derive the existing render or state alternative inline without introducing another mutable state variable (including followLive ? undefined : result.revisionId); no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types; unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

const PureDocumentToolResult = ({
  disabled = false,
  followLive = false,
  type,
  result,
  isReadonly: _isReadonly,
  messageId,
}: DocumentToolResultProps) => {
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
        {(() => {
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
/* oxlint-enable no-ternary, no-undefined, react-perf/jsx-no-new-function-as-prop, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, unicorn/no-null */
/* oxlint-disable import/exports-last, import/group-exports, import/no-named-export -- DocumentToolResult: import/exports-last: keep this public declaration beside its implementation so its props and behavior remain reviewable together; import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; import/no-named-export: existing callers import this public component, type, or hook by name. */

export const DocumentToolResult = memo(PureDocumentToolResult);
/* oxlint-enable import/exports-last, import/group-exports, import/no-named-export */

interface DocumentToolCallProps {
  args: { title?: string };
  isReadonly: boolean;
  type: "create" | "update" | "read";
}
/* oxlint-disable no-ternary, oxc/no-rest-spread-properties, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, react/no-multi-comp, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null -- PureDocumentToolCall: no-ternary: derive the existing render or state alternative inline without introducing another mutable state variable (including args.title ? "${args.title}" : ""); oxc/no-rest-spread-properties: compose immutable state or forward the remaining typed props without mutating the caller object; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including currentArtifact); typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including args.title); unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

const PureDocumentToolCall = ({
  type,
  args,
  isReadonly: _isReadonly,
}: DocumentToolCallProps) => {
  const { setArtifact } = useArtifact();

  return (
    <button
      className="cursor pointer flex w-fit flex-row items-start justify-between gap-3 rounded-xl border px-3 py-2"
      onClick={() => {
        setArtifact((currentArtifact) => ({
          ...currentArtifact,
          isVisible: true,
        }));
      }}
      type="button"
    >
      <div className="flex flex-row items-start gap-3">
        <div className="text-muted-foreground mt-1">
          {(() => {
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
/* oxlint-enable no-ternary, oxc/no-rest-spread-properties, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, react/no-multi-comp, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null */
/* oxlint-disable import/group-exports, import/no-named-export -- DocumentToolCall: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; import/no-named-export: existing callers import this public component, type, or hook by name. */

export const DocumentToolCall = memo(PureDocumentToolCall, () => true);
/* oxlint-enable import/group-exports, import/no-named-export */
