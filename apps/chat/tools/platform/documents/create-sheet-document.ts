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
    async execute({ title, content }): Promise<DocumentToolResult> {
      const id = generateUUID();

      if (session.user?.id) {
        await saveDocument({
          content,
          id,
          kind: "sheet",
          messageId,
          title,
          userId: session.user.id,
        });
      }

      return {
        date: new Date().toISOString(),
        documentId: id,
        result: "A document was created and is now visible to the user.",
        status: "success",
      };
    },
    inputSchema: z.object({
      content: z.string().describe("The full CSV content of the spreadsheet"),
      title: z.string().describe("Spreadsheet title"),
    }),
  });
