import { tool } from "ai";
import { z } from "zod";

import { saveDocument } from "@/lib/db/queries";
import { generateUUID } from "@/lib/utils";

import { textGuidelines } from "./text-guidelines";
import type { DocumentToolContext, DocumentToolResult } from "./types";

export const saveTextDocument = async (
  { content, title }: { content: string; title: string },
  { messageId, session }: Pick<DocumentToolContext, "messageId" | "session">
): Promise<DocumentToolResult> => {
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
};

export const createTextDocumentTool = ({
  messageId,
  session,
}: DocumentToolContext) =>
  tool({
    description: `Create a text document with markdown support.

Use for:
- Essays, articles, blog posts, reports
- Documentation, guides, tutorials
- Emails, letters, formal writing
${textGuidelines}

The title should be descriptive of the content.`,
    execute: (input) => saveTextDocument(input, { messageId, session }),
    inputSchema: z.object({
      content: z.string().describe("The full markdown content of the document"),
      title: z.string().describe("Document title"),
    }),

    // Future optimization: exclude content from messages other than the current message.
    // toModelOutput: ({input}) => (),
  });
