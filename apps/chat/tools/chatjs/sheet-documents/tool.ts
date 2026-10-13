import {
  eveDocumentCreateInput,
  eveDocumentEditInput,
  eveDocumentWriteResult,
} from "@/lib/eve/document-contracts";
import type { ToolContext } from "eve/tools";
import { defineTool } from "eve/tools";
import { executeEveDocumentTool } from "@/lib/eve/document-tools";
import { sheetGuidelines } from "./guidelines";
import type { z } from "zod";

type CreateSheetDocumentInput = Readonly<
  Omit<z.infer<typeof eveDocumentCreateInput>, "fileIds"> & {
    fileIds: readonly string[];
  }
>;

type EditSheetDocumentInput = Readonly<
  Omit<z.infer<typeof eveDocumentEditInput>, "fileIds"> & {
    fileIds: readonly string[];
  }
>;

type ReadonlyDocumentToolContext = Readonly<
  Pick<ToolContext, "callId" | "session"> & {
    abortSignal: Readonly<AbortSignal>;
  }
>;

const createSheetDocument = defineTool({
  description: `Create a new sheet document in this conversation. Supply the complete content and a descriptive title. ${sheetGuidelines}`,
  execute: async (
    input: CreateSheetDocumentInput,
    context: ReadonlyDocumentToolContext
  ) =>
    eveDocumentWriteResult.parse(
      await executeEveDocumentTool("createSheetDocument", input, context)
    ),
  inputSchema: eveDocumentCreateInput,
  outputSchema: eveDocumentWriteResult,
});
const editSheetDocument = defineTool({
  description: `Edit an existing sheet document in this conversation. Read the document first and supply its revision ID. Supply the complete replacement content. ${sheetGuidelines}`,
  execute: async (
    input: EditSheetDocumentInput,
    context: ReadonlyDocumentToolContext
  ) =>
    eveDocumentWriteResult.parse(
      await executeEveDocumentTool("editSheetDocument", input, context)
    ),
  inputSchema: eveDocumentEditInput,
  outputSchema: eveDocumentWriteResult,
});
export { createSheetDocument, editSheetDocument };
