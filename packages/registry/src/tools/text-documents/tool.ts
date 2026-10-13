import {
  eveDocumentCreateInput,
  eveDocumentEditInput,
  eveDocumentWriteResult,
} from "@/lib/eve/document-contracts";
import type { ToolContext } from "eve/tools";
import { defineTool } from "eve/tools";
import { executeEveDocumentTool } from "@/lib/eve/document-tools";
import { textGuidelines } from "./guidelines";
import type { z } from "zod";

type CreateTextDocumentInput = Readonly<
  Omit<z.infer<typeof eveDocumentCreateInput>, "fileIds"> & {
    fileIds: readonly string[];
  }
>;

type EditTextDocumentInput = Readonly<
  Omit<z.infer<typeof eveDocumentEditInput>, "fileIds"> & {
    fileIds: readonly string[];
  }
>;

type ReadonlyDocumentToolContext = Readonly<
  Pick<ToolContext, "callId" | "session"> & {
    abortSignal: Readonly<AbortSignal>;
  }
>;

const createTextDocument = defineTool({
  description: `Create a new text document in this conversation. Supply the complete content and a descriptive title. ${textGuidelines}`,
  execute: async (
    input: CreateTextDocumentInput,
    context: ReadonlyDocumentToolContext
  ) =>
    eveDocumentWriteResult.parse(
      await executeEveDocumentTool("createTextDocument", input, context)
    ),
  inputSchema: eveDocumentCreateInput,
  outputSchema: eveDocumentWriteResult,
});
const editTextDocument = defineTool({
  description: `Edit an existing text document in this conversation. Read the document first and supply its revision ID. Supply the complete replacement content. ${textGuidelines}`,
  execute: async (
    input: EditTextDocumentInput,
    context: ReadonlyDocumentToolContext
  ) =>
    eveDocumentWriteResult.parse(
      await executeEveDocumentTool("editTextDocument", input, context)
    ),
  inputSchema: eveDocumentEditInput,
  outputSchema: eveDocumentWriteResult,
});
export { createTextDocument, editTextDocument };
