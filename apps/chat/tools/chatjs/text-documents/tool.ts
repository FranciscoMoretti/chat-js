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

import { textGuidelines } from "./guidelines";

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

/* oxlint-disable oxc/no-async-await -- Await the async executor before schema parsing; enabled promise/prefer-await-to-then and typescript/promise-function-async reject the equivalent .then(parse) callback. */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Await the async executor before schema parsing; enabled promise/prefer-await-to-then and typescript/promise-function-async reject the equivalent .then(parse) callback. */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (createTextDocument, editTextDocument); the enabled import/no-default-export convention rejects the default-export alternative. */
export { createTextDocument, editTextDocument };
/* oxlint-enable import/no-named-export */
