import {
  eveDocumentCreateInput,
  eveDocumentEditInput,
  eveDocumentWriteResult,
} from "@/lib/eve/document-contracts";
import type { ToolContext } from "eve/tools";
import { codeGuidelines } from "./guidelines";
import { defineTool } from "eve/tools";
import { executeEveDocumentTool } from "@/lib/eve/document-tools";
import type { z } from "zod";

type CreateCodeDocumentInput = Readonly<
  Omit<z.infer<typeof eveDocumentCreateInput>, "fileIds"> & {
    fileIds: readonly string[];
  }
>;

type EditCodeDocumentInput = Readonly<
  Omit<z.infer<typeof eveDocumentEditInput>, "fileIds"> & {
    fileIds: readonly string[];
  }
>;

type ReadonlyDocumentToolContext = Readonly<
  Pick<ToolContext, "callId" | "session"> & {
    abortSignal: Readonly<AbortSignal>;
  }
>;

const createCodeDocument = defineTool({
  description: `Create a new code document in this conversation. Supply the complete content and a descriptive title. ${codeGuidelines}`,
  execute: async (
    input: CreateCodeDocumentInput,
    context: ReadonlyDocumentToolContext
  ) =>
    eveDocumentWriteResult.parse(
      await executeEveDocumentTool("createCodeDocument", input, context)
    ),
  inputSchema: eveDocumentCreateInput,
  outputSchema: eveDocumentWriteResult,
});
const editCodeDocument = defineTool({
  description: `Edit an existing code document in this conversation. Read the document first and supply its revision ID. Supply the complete replacement content. ${codeGuidelines}`,
  execute: async (
    input: EditCodeDocumentInput,
    context: ReadonlyDocumentToolContext
  ) =>
    eveDocumentWriteResult.parse(
      await executeEveDocumentTool("editCodeDocument", input, context)
    ),
  inputSchema: eveDocumentEditInput,
  outputSchema: eveDocumentWriteResult,
});
export { createCodeDocument, editCodeDocument };
