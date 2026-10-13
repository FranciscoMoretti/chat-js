import {
  eveDocumentReadInput,
  eveDocumentReadResult,
} from "@/lib/eve/document-contracts";
import type { ToolContext } from "eve/tools";
import { defineTool } from "eve/tools";
import { executeEveDocumentTool } from "@/lib/eve/document-tools";
import type { z } from "zod";

type ReadonlyReadInput = Readonly<z.infer<typeof eveDocumentReadInput>>;

type ReadonlyReadContext = Readonly<
  Pick<ToolContext, "callId" | "session"> & {
    abortSignal: Readonly<AbortSignal>;
  }
>;

export const readDocument = defineTool({
  description:
    "Read the latest document content and revision ID in this conversation before editing it.",
  execute: async (input: ReadonlyReadInput, context: ReadonlyReadContext) =>
    eveDocumentReadResult.parse(
      await executeEveDocumentTool("readDocument", input, context)
    ),
  inputSchema: eveDocumentReadInput,
  outputSchema: eveDocumentReadResult,
});
