import { hasText } from "@/components/text-value";
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

const DocumentToolResult = memo(PureDocumentToolResult);

interface DocumentToolCallProps {
  readonly args: { readonly title?: string };
  readonly isReadonly: boolean;
  readonly type: "create" | "update" | "read";
}

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
          {`${getActionText(type, "present")} ${hasText(args.title) ? `"${args.title}"` : ""}`}
        </div>
      </div>

      <div className="mt-1 animate-spin">
        <Loader2 size={16} />
      </div>
    </button>
  );
};

const DocumentToolCall = memo(PureDocumentToolCall, () => true);
export { DocumentToolCall, DocumentToolResult, hasProp, isArtifactToolResult };
