import { Copy, History, Pen, Redo2, Undo2 } from "lucide-react";
import dynamic from "next/dynamic";
import { toast } from "sonner";

import { Artifact } from "@/components/create-artifact";
import { DocumentSkeleton } from "@/components/document-skeleton";
import { config } from "@/lib/config";

const DiffView = dynamic(
  () => import("@/components/diffview").then((m) => ({ default: m.DiffView })),
  {
    loading: () => <DocumentSkeleton artifactKind="text" />,
    ssr: false,
  }
);

const Editor = dynamic(
  () => import("@/components/text-editor").then((m) => ({ default: m.Editor })),
  {
    loading: () => <DocumentSkeleton artifactKind="text" />,
    ssr: false,
  }
);
export const textArtifact = new Artifact<"text">({
  actions: [
    {
      description: "View changes",
      icon: <History size={18} />,
      isDisabled: ({ currentVersionIndex }) => {
        if (currentVersionIndex === 0) {
          return true;
        }

        return false;
      },
      onClick: ({ handleVersionChange }) => {
        handleVersionChange("toggle");
      },
    },
    {
      description: "View Previous version",
      icon: <Undo2 size={18} />,
      isDisabled: ({ currentVersionIndex }) => {
        if (currentVersionIndex === 0) {
          return true;
        }

        return false;
      },
      onClick: ({ handleVersionChange }) => {
        handleVersionChange("prev");
      },
    },
    {
      description: "View Next version",
      icon: <Redo2 size={18} />,
      isDisabled: ({ isCurrentVersion }) => {
        if (isCurrentVersion) {
          return true;
        }

        return false;
      },
      onClick: ({ handleVersionChange }) => {
        handleVersionChange("next");
      },
    },
    {
      description: "Copy to clipboard",
      icon: <Copy size={18} />,
      onClick: ({ content }) => {
        navigator.clipboard.writeText(content);
        toast.success("Copied to clipboard!");
      },
    },
  ],
  content: ({
    mode,
    status,
    content,
    isCurrentVersion,
    currentVersionIndex,
    onSaveContent,
    getDocumentContentById,
    isLoading,
    isReadonly,
  }) => {
    if (isLoading) {
      return <DocumentSkeleton artifactKind="text" />;
    }

    if (mode === "diff") {
      const oldContent = getDocumentContentById(currentVersionIndex - 1);
      const newContent = getDocumentContentById(currentVersionIndex);

      return (
        <div className="m-auto flex max-w-3xl flex-row px-4 py-8 md:p-20">
          <DiffView newContent={newContent} oldContent={oldContent} />
        </div>
      );
    }

    return (
      <div className="m-auto flex max-w-3xl flex-row px-4 py-8 md:p-20">
        <Editor
          content={content}
          currentVersionIndex={currentVersionIndex}
          isCurrentVersion={isCurrentVersion}
          isReadonly={isReadonly}
          onSaveContent={onSaveContent}
          status={status}
        />
      </div>
    );
  },
  description: "Useful for text content, like drafting essays and emails.",
  kind: "text",
  toolbar: [
    {
      description: "Add final polish",
      icon: <Pen size={16} />,
      onClick: ({ sendMessage, storeApi }) => {
        const selectedModel = config.ai.tools.text.polish;
        const createdAt = new Date();
        const parentMessageId = storeApi.getState().getLastMessageId();

        sendMessage({
          metadata: {
            activeStreamId: null,
            createdAt,
            parentMessageId,
            selectedModel,
          },
          parts: [
            {
              text: "Please add final polish and check for grammar, add section titles for better structure, and ensure everything reads smoothly.",
              type: "text",
            },
          ],
          role: "user",
        });
      },
    },
  ],
});
