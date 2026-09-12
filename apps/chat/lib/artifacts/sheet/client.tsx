import { Copy, LineChart, Redo2, Sparkles, Undo2 } from "lucide-react";
import { parse, unparse } from "papaparse";
import { toast } from "sonner";

import { Artifact } from "@/components/create-artifact";
import type { ArtifactMetadata } from "@/components/create-artifact";
import { SpreadsheetEditor } from "@/components/sheet-editor";
import { config } from "@/lib/config";

export type SheetArtifactMetadata = Record<string, unknown>;

export function getSheetArtifactMetadata(
  metadata: ArtifactMetadata
): SheetArtifactMetadata {
  return metadata && typeof metadata === "object"
    ? Object.fromEntries(Object.entries(metadata))
    : {};
}

export const sheetArtifact = new Artifact<"sheet", SheetArtifactMetadata>({
  actions: [
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
      description: "Copy as .csv",
      icon: <Copy size={16} />,
      onClick: ({ content }) => {
        const parsed = parse<string[]>(content, { skipEmptyLines: true });

        const nonEmptyRows = parsed.data.filter((row) =>
          row.some((cell) => cell.trim() !== "")
        );

        const cleanedCsv = unparse(nonEmptyRows);

        navigator.clipboard.writeText(cleanedCsv);
        toast.success("Copied csv to clipboard!");
      },
    },
  ],
  content: ({
    content,
    currentVersionIndex,
    isCurrentVersion,
    onSaveContent,
    status,
    isReadonly,
  }) => (
    <SpreadsheetEditor
      content={content}
      currentVersionIndex={currentVersionIndex}
      isCurrentVersion={isCurrentVersion}
      isReadonly={isReadonly}
      saveContent={onSaveContent}
      status={status}
    />
  ),
  description: "Useful for working with spreadsheets",
  initialize: async () => {
    // No initialization needed for sheet artifact
  },
  kind: "sheet",
  toolbar: [
    {
      description: "Format and clean data",
      icon: <Sparkles size={16} />,
      onClick: ({ sendMessage, storeApi }) => {
        const selectedModel = config.ai.tools.sheet.format;
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
            { text: "Can you please format and clean the data?", type: "text" },
          ],
          role: "user",
        });
      },
    },
    {
      description: "Analyze and visualize data",
      icon: <LineChart size={16} />,
      onClick: ({ sendMessage, storeApi }) => {
        const selectedModel = config.ai.tools.sheet.analyze;
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
              text: "Can you please analyze and visualize the data by creating a new code artifact in python?",
              type: "text",
            },
          ],
          role: "user",
        });
      },
    },
  ],
});
