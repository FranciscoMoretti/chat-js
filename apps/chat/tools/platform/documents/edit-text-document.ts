import { tool } from "ai";
import { z } from "zod";
import { updateDocument } from "@/lib/db/queries";
import { textGuidelines } from "./text-guidelines";
import type { DocumentToolContext, DocumentToolResult } from "./types";

export const editTextDocumentTool = ({
  session,
  messageId,
}: DocumentToolContext) =>
  tool({
    description: `Edit an existing text document with markdown support.

Use for editing:
- Essays, articles, blog posts, reports
- Documentation, guides, tutorials
- Emails, letters, formal writing
${textGuidelines}

Important: You must first read the document content before editing.

Avoid:
- Updating immediately after a document was just created
- Using this if there is no previous document in the conversation`,
    inputSchema: z.object({
      documentId: z.string().describe("The ID of the document to edit"),
      title: z.string().describe("Document title"),
      content: z.string().describe("The full updated markdown content"),
    }),

    async execute({ documentId, title, content }): Promise<DocumentToolResult> {
      if (!session.user?.id) {
        return { status: "error", error: "Authentication required" };
      }
      const saved = await updateDocument({
        id: documentId,
        title,
        content,
        kind: "text",
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
