import { File, Loader2, Pencil } from "lucide-react";
import { memo } from "react";

import { useArtifact } from "@/hooks/use-artifact";
import type { ArtifactKind } from "@/lib/artifacts/artifact-kind";

export const hasProp = <T extends string>(
  obj: unknown,
  prop: T
): obj is Record<T, unknown> =>
  typeof obj === "object" && obj !== null && prop in obj;

export const isArtifactToolResult = (
  o: unknown
): o is { id: string; title: string; kind: ArtifactKind } =>
  hasProp(o, "id") &&
  typeof o.id === "string" &&
  hasProp(o, "title") &&
  typeof o.title === "string" &&
  hasProp(o, "kind") &&
  typeof o.kind === "string";

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

interface DocumentToolResultProps {
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

const PureDocumentToolResult = ({
  disabled = false,
  type,
  result,
  isReadonly: _isReadonly,
  messageId,
}: DocumentToolResultProps) => {
  const { setArtifact } = useArtifact();

  return (
    <button
      className="bg-background flex w-fit cursor-pointer flex-row items-center gap-3 rounded-xl border px-3 py-2"
      disabled={disabled}
      onClick={() => {
        setArtifact({
          content: "",
          documentId: result.id,
          isVisible: true,
          kind: result.kind,
          messageId,
          revisionId: result.revisionId,
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

export const DocumentToolResult = memo(PureDocumentToolResult);

interface DocumentToolCallProps {
  args: { title?: string };
  isReadonly: boolean;
  type: "create" | "update" | "read";
}

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

export const DocumentToolCall = memo(PureDocumentToolCall, () => true);
