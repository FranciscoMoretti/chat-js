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

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { codeGuidelines } from "./guidelines";

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

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve createCodeDocument's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable sort-imports */

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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve editCodeDocument's awaited sequencing and rejected-Promise behavior. */

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
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (createCodeDocument, editCodeDocument); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-enable oxc/no-async-await */
export { createCodeDocument, editCodeDocument };
/* oxlint-enable import/no-named-export */
