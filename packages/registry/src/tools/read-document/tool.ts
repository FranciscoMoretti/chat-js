import type { ToolContext } from "eve/tools";
import { defineTool } from "eve/tools";
import type { z } from "zod";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  eveDocumentReadInput,
  eveDocumentReadResult,
} from "@/lib/eve/document-contracts";
/* oxlint-enable sort-imports */
import { executeEveDocumentTool } from "@/lib/eve/document-tools";

type ReadonlyReadInput = Readonly<z.infer<typeof eveDocumentReadInput>>;

type ReadonlyReadContext = Readonly<
  Pick<ToolContext, "callId" | "session"> & {
    abortSignal: Readonly<AbortSignal>;
  }
>;

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (readDocument); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve readDocument's awaited sequencing and rejected-Promise behavior. */
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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
