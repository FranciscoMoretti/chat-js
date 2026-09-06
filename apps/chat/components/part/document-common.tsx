import { File, Loader2, Pencil } from "lucide-react";
import { memo } from "react";
import type { UIArtifact } from "@/components/artifact-panel";
import { useArtifact } from "@/hooks/use-artifact";
import type { ChatMessage } from "@/lib/ai/types";
import type { ArtifactKind } from "@/lib/artifacts/artifact-kind";
import type {
  CreateDocumentToolType,
  EditDocumentToolType,
} from "@/tools/platform/documents/types";

export type CreateDocumentTool = Extract<
  ChatMessage["parts"][number],
  { type: CreateDocumentToolType }
>;

export type EditDocumentTool = Extract<
  ChatMessage["parts"][number],
  { type: EditDocumentToolType }
>;

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
  type: "create" | "update",
  tense: "present" | "past"
) => {
  switch (type) {
    case "create":
      return tense === "present" ? "Creating" : "Created";
    case "update":
      return tense === "present" ? "Updating" : "Updated";
    default:
      return null;
  }
};

interface DocumentToolResultProps {
  isReadonly: boolean;
  messageId: string;
  result: {
    id: string;
    title: string;
    kind: ArtifactKind;
  };
  toolCallId?: string;
  type: "create" | "update";
}

function PureDocumentToolResult({
  type,
  result,
  isReadonly: _isReadonly,
  messageId,
  toolCallId,
}: DocumentToolResultProps) {
  const { openArtifact } = useArtifact();

  return (
    <button
      className="flex w-fit cursor-pointer flex-row items-center gap-3 rounded-xl border bg-background px-3 py-2"
      onClick={() => {
        openArtifact({
          documentId: result.id,
          kind: result.kind,
          content: "",
          title: result.title,
          messageId,
          toolCallId,
          isVisible: true,
          status: "idle",
        });
      }}
      type="button"
    >
      <div className="text-muted-foreground">
        {(() => {
          if (type === "create") {
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
}

export const DocumentToolResult = memo(PureDocumentToolResult);

interface DocumentToolCallProps {
  args: { title?: string };
  artifact: UIArtifact;
  isReadonly: boolean;
  type: "create" | "update";
}

function PureDocumentToolCall({
  artifact,
  type,
  args,
  isReadonly: _isReadonly,
}: DocumentToolCallProps) {
  const { openArtifact } = useArtifact();

  return (
    <button
      className="cursor pointer flex w-fit flex-row items-start justify-between gap-3 rounded-xl border px-3 py-2"
      onClick={() => {
        openArtifact(artifact);
      }}
      type="button"
    >
      <div className="flex flex-row items-start gap-3">
        <div className="mt-1 text-muted-foreground">
          {(() => {
            if (type === "create") {
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

      <div className="mt-1 animate-spin">{<Loader2 size={16} />}</div>
    </button>
  );
}

export const DocumentToolCall = memo(PureDocumentToolCall);
