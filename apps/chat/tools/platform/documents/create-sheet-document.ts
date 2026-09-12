import { tool } from "ai";
import { z } from "zod";
import { saveDocument } from "@/lib/db/queries";
import { generateUUID } from "@/lib/utils";
import { sheetGuidelines } from "./sheet-guidelines";
import type { DocumentToolContext, DocumentToolResult } from "./types";

export const createSheetDocumentTool = ({
  session,
  messageId,
}: DocumentToolContext) =>
  tool({
    description: `Create a spreadsheet document in CSV format.

Use for:
- Data tables and datasets
- Lists with multiple columns
- Financial data, statistics
- Any tabular information
${sheetGuidelines}

The spreadsheet will be created with proper column headers and data.`,
    inputSchema: z.object({
      title: z.string().describe("Spreadsheet title"),
      content: z.string().describe("The full CSV content of the spreadsheet"),
    }),

    async execute({ title, content }): Promise<DocumentToolResult> {
      if (!session.user?.id) {
        return { status: "error", error: "Authentication required" };
      }
      const id = generateUUID();

      const saved = await saveDocument({
        id,
        title,
        content,
        kind: "sheet",
        userId: session.user.id,
        messageId,
      });

      return {
        status: "success",
        documentId: id,
        result: "A document was created and is now visible to the user.",
        date: saved.createdAt.toISOString(),
      };
    },
  });
