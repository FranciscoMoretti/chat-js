import { tool } from "ai";
import { z } from "zod";
import { updateDocument } from "@/lib/db/queries";
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
    inputSchema: z.object({
      documentId: z.string().describe("The ID of the document to edit"),
      title: z
        .string()
        .describe(
          'Filename with extension (e.g., "script.py", "component.tsx", "utils.js")'
        ),
      content: z.string().describe("The full updated code content"),
    }),

    async execute({ documentId, title, content }): Promise<DocumentToolResult> {
      if (!session.user?.id) {
        return { status: "error", error: "Authentication required" };
      }
      const saved = await updateDocument({
        id: documentId,
        title,
        content,
        kind: "code",
        userId: session.user.id,
        messageId,
      });
      if (!saved) {
        return { status: "error", error: "Document not found" };
      }

      return {
        status: "success",
        documentId,
        result: "The document was updated and is now visible to the user.",
        date: saved.createdAt.toISOString(),
      };
    },
  });
