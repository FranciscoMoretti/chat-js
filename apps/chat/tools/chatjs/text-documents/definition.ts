import { z } from "zod";
import type { DocumentDefinition } from "@/lib/eve/document-definition";

export const documentDefinition = {
  kind: "text",
  contentSchema: z.string().max(2_000_000),
  createTool: "createTextDocument",
  editTool: "editTextDocument",
} as const satisfies DocumentDefinition;
