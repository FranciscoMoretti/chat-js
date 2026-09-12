import { tool } from "ai";
import { z } from "zod";

import { saveDocument } from "@/lib/db/queries";
import { generateUUID } from "@/lib/utils";

import { codeGuidelines } from "./code-guidelines";
import type { DocumentToolContext, DocumentToolResult } from "./types";

export const createCodeDocumentTool = ({
  session,
  messageId,
}: DocumentToolContext) =>
  tool({
    description: `Create a code document/file.

Use for:
- Python scripts and programs
- Code snippets that need to be saved
- Single-file code examples
${codeGuidelines}`,
    async execute({ title, content }): Promise<DocumentToolResult> {
      const id = generateUUID();

      if (session.user?.id) {
        await saveDocument({
          content,
          id,
          kind: "code",
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
      content: z.string().describe("The full code content of the document"),
      title: z
        .string()
        .describe(
          'Filename with extension (e.g., "script.py", "component.tsx", "utils.js")'
        ),
    }),
  });
