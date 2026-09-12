import { tool } from "ai";
import { z } from "zod";

import { getDocumentById, saveDocument } from "@/lib/db/queries";

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
    async execute({ documentId, title, content }): Promise<DocumentToolResult> {
      const document = await getDocumentById({ id: documentId });

      if (!document) {
        return { error: "Document not found", status: "error" };
      }

      if (document.kind !== "text") {
        return { error: "Document is not a text document", status: "error" };
      }

      if (session.user?.id) {
        await saveDocument({
          content,
          id: documentId,
          kind: "text",
          messageId,
          title,
          userId: session.user.id,
        });
      }

      return {
        date: new Date().toISOString(),
        documentId,
        result: "The document was updated and is now visible to the user.",
        status: "success",
      };
    },
    inputSchema: z.object({
      content: z.string().describe("The full updated markdown content"),
      documentId: z.string().describe("The ID of the document to edit"),
      title: z.string().describe("Document title"),
    }),
  });
