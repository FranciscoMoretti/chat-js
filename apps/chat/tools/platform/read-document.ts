import { tool } from "ai";
import { z } from "zod";

import type { StreamWriter } from "@/lib/ai/types";
import { getDocumentById } from "@/lib/db/queries";

import type { ToolSession } from "./types";

interface ReadDocumentProps {
  dataStream: StreamWriter;
  session: ToolSession;
}

export const readDocument = ({
  session,
  dataStream: _dataStream,
}: ReadDocumentProps) =>
  tool({
    description: `Read the contents of a document created earlier in this chat.

Use for:
- Retrieve document text for follow-up analysis or questions

Avoid:
- Documents that were not produced in the current conversation`,
    execute: async ({ documentId }) => {
      const document = await getDocumentById({ id: documentId });

      if (!document) {
        return {
          error: "Document not found",
        };
      }

      if (document.userId !== session.user?.id) {
        return {
          error: "Unauthorized access to document",
        };
      }

      return {
        documentId: document.id,
        title: document.title,
        kind: document.kind,
        content: document.content,
        createdAt: document.createdAt,
      };
    },
    inputSchema: z.object({
      documentId: z.string().describe("The ID of the document to read"),
    }),
  });
