import { z } from "zod";
import type { DocumentDefinition } from "@/chatjs/core/documents/document-definition";

export const documentDefinition = {
  kind: "code",
  contentSchema: z.string().max(2_000_000),
  createTool: "createCodeDocument",
  editTool: "editCodeDocument",
} as const satisfies DocumentDefinition;
