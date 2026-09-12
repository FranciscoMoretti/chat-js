import type { ModelId } from "@/lib/ai/app-models";
import type { ArtifactKind } from "@/lib/artifacts/artifact-kind";
import type { CostAccumulator } from "@/lib/credits/cost-accumulator";

import type { ToolSession } from "../types";

export type DocumentToolResult =
  | {
      status: "success";
      documentId: string;
      result: string;
      date: string;
    }
  | {
      status: "error";
      error: string;
    };

export interface DocumentToolContext {
  costAccumulator?: CostAccumulator;
  // dataStream: StreamWriter;
  messageId: string;
  selectedModel: ModelId;
  session: ToolSession;
}

// Document tool type names as they appear in ChatMessage parts
export const createDocumentToolTypes = [
  "tool-createTextDocument",
  "tool-createCodeDocument",
  "tool-createSheetDocument",
] as const;

export const editDocumentToolTypes = [
  "tool-editTextDocument",
  "tool-editCodeDocument",
  "tool-editSheetDocument",
] as const;

export const documentToolTypes = [
  ...createDocumentToolTypes,
  ...editDocumentToolTypes,
] as const;

export type CreateDocumentToolType = (typeof createDocumentToolTypes)[number];
export type EditDocumentToolType = (typeof editDocumentToolTypes)[number];
export type DocumentToolType = (typeof documentToolTypes)[number];

// Explicit mapping from tool type to artifact kind
const toolTypeToKindMap: Record<DocumentToolType, ArtifactKind> = {
  "tool-createCodeDocument": "code",
  "tool-createSheetDocument": "sheet",
  "tool-createTextDocument": "text",
  "tool-editCodeDocument": "code",
  "tool-editSheetDocument": "sheet",
  "tool-editTextDocument": "text",
};

export const getToolKind = (toolType: DocumentToolType): ArtifactKind =>
  toolTypeToKindMap[toolType];

export const isEditTool = (toolType: DocumentToolType): boolean =>
  (editDocumentToolTypes as readonly string[]).includes(toolType);
