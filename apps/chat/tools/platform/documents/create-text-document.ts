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
    async execute({ title, content }): Promise<DocumentToolResult> {
      const id = generateUUID();

      if (session.user?.id) {
        await saveDocument({
          content,
          id,
          kind: "text",
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
      content: z.string().describe("The full markdown content of the document"),
      title: z.string().describe("Document title"),
    }),
  });
