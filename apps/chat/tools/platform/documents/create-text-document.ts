import { tool } from "ai";
import { z } from "zod";
import { saveDocument } from "@/lib/db/queries";
import { generateUUID } from "@/lib/utils";
import { textGuidelines } from "./text-guidelines";
import type { DocumentToolContext, DocumentToolResult } from "./types";

export const createTextDocumentTool = ({
  session,
  messageId,
}: DocumentToolContext) =>
  tool({
    description: `Create a text document with markdown support.

Use for:
- Essays, articles, blog posts, reports
- Documentation, guides, tutorials
- Emails, letters, formal writing
${textGuidelines}

The title should be descriptive of the content.`,
    inputSchema: z.object({
      title: z.string().describe("Document title"),
      content: z.string().describe("The full markdown content of the document"),
    }),

    // TODO: Optimize what's rendered to the model by excluding content from messages !== curMessage
    // toModelOutput: ({input}) => (),
    async execute({ title, content }): Promise<DocumentToolResult> {
      if (!session.user?.id) {
        return { status: "error", error: "Authentication required" };
      }
      const id = generateUUID();

      const saved = await saveDocument({
        id,
        title,
        content,
        kind: "text",
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
