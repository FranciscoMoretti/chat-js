import { tool } from "ai";
import { z } from "zod";

import { getDocumentById, saveDocument } from "@/lib/db/queries";

import { codeGuidelines } from "./code-guidelines";
import type { DocumentToolContext, DocumentToolResult } from "./types";

export const editCodeDocumentTool = ({
  session,
  messageId,
}: DocumentToolContext) =>
  tool({
    description: `Edit an existing code document/file.

Use for editing:
- Python scripts and programs
- Code snippets that need to be saved
- Single-file code examples
${codeGuidelines}

Important: You must first read the document content before editing.

Avoid:
- Updating immediately after a document was just created
- Using this if there is no previous document in the conversation`,
    async execute({ documentId, title, content }): Promise<DocumentToolResult> {
      const document = await getDocumentById({ id: documentId });

      if (!document) {
        return { status: "error", error: "Document not found" };
      }

      if (document.kind !== "code") {
        return { status: "error", error: "Document is not a code document" };
      }

      if (session.user?.id) {
        await saveDocument({
          id: documentId,
          title,
          content,
          kind: "code",
          userId: session.user.id,
          messageId,
        });
      }

      return {
        status: "success",
        documentId,
        result: "The document was updated and is now visible to the user.",
        date: new Date().toISOString(),
      };
    },
    inputSchema: z.object({
      documentId: z.string().describe("The ID of the document to edit"),
      title: z
        .string()
        .describe(
          'Filename with extension (e.g., "script.py", "component.tsx", "utils.js")'
        ),
      content: z.string().describe("The full updated code content"),
    }),
  });
