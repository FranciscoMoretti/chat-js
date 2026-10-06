import type { ToolContext } from "eve/tools";
import { defineTool } from "eve/tools";
import type { z } from "zod";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  eveDocumentCreateInput,
  eveDocumentEditInput,
  eveDocumentWriteResult,
} from "@/lib/eve/document-contracts";
/* oxlint-enable sort-imports */
import { executeEveDocumentTool } from "@/lib/eve/document-tools";

import { sheetGuidelines } from "./guidelines";

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

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve createSheetDocument's awaited sequencing and rejected-Promise behavior. */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve editSheetDocument's awaited sequencing and rejected-Promise behavior. */

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
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (createSheetDocument, editSheetDocument); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-enable oxc/no-async-await */
export { createSheetDocument, editSheetDocument };
/* oxlint-enable import/no-named-export */
