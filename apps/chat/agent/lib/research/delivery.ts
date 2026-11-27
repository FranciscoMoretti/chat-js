import type { WorkflowStepToolContext } from "eve/tools";
import { storageEnvRequirements } from "@/chatjs/providers/storage-options";
import { getMissingRequirement } from "@/lib/config-requirements";
import { eveGeneratedFileUploader } from "@/lib/eve/generated-files";
import type { ResearchArtifact } from "./schemas";

// oxlint-disable-next-line eslint/func-style -- EVE durable steps require declarations.
export async function publishResearchReport(
  context: Readonly<WorkflowStepToolContext>,
  markdown: string
): Promise<ResearchArtifact | null> {
  "use step";
  context.abortSignal.throwIfAborted();
  const { current, initiator } = context.session.auth;
  if (
    context.session.parent ||
    current?.authenticator !== "chatjs-gateway" ||
    initiator?.authenticator !== "chatjs-gateway" ||
    current.principalId !== initiator.principalId ||
    storageEnvRequirements.some(
      (requirement) => getMissingRequirement(requirement, process.env) !== null
    )
  ) {
    return null;
  }
  const file = await eveGeneratedFileUploader(context, {
    idempotencyKey: `deep-research:${context.callId}`,
  })("report.md", markdown, "text/plain");
  return {
    fileId: file.fileId,
    mediaType: file.contentType,
    name: file.pathname,
    size: Buffer.byteLength(markdown),
    url: file.url,
  };
}
