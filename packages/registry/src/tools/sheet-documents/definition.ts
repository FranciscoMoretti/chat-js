import { z } from "zod";
import type { DocumentDefinition } from "@/chatjs/core/documents/document-definition";

export const documentDefinition = {
  kind: "sheet",
  contentSchema: z.string().max(2_000_000),
  createTool: "createSheetDocument",
  editTool: "editSheetDocument",
} as const satisfies DocumentDefinition;
