import { defineTool, toolOutput } from "eve/tools";
import { resolveEveConversationScope } from "@/lib/eve/conversation-scope";
import { attachConversationFile } from "./attach-conversation-file";
import {
  attachWorkspaceFileInput,
  attachWorkspaceFileResult,
  importFileInput,
  importFileResult,
} from "./schemas";
import { importStoredFile } from "./import";
import { withEveConversationFile } from "@/lib/db/eve-files";
import { downloadFile, getFileMetadata } from "@/lib/file-storage";

export const attach_workspace_file = defineTool({
  description:
    "Attach a finished workspace file to the current ChatJS conversation as a downloadable artifact. Creates a new durable snapshot; later sandbox edits do not change it. Use for user-requested deliverables, not intermediate files. To revise an earlier artifact, import_file using its exact fileId, edit the workspace copy with native tools, then attach_workspace_file again. Earlier downloads remain unchanged. Maximum 32 MiB. Delegated agents return the file path to the parent so it can attach the file.",
  inputSchema: attachWorkspaceFileInput,
  outputSchema: attachWorkspaceFileResult,
  availableInSubagents: false,
  async execute(input, context) {
    return await attachConversationFile(input, context);
  },
  toModelOutput: (output) => toolOutput.json(output),
});

export const import_file = defineTool({
  description:
    "Import a published artifact or uploaded file referenced in the current ChatJS conversation into the current EVE workspace. Use before revising an earlier file, including after its original sandbox is gone. Supply its exact fileId and filename from conversation history; ask the user to identify or upload the file if ambiguous. Returns a fresh local copy. Edit it with native tools and attach_workspace_file to deliver a new snapshot. The original is never changed. Maximum 32 MiB.",
  inputSchema: importFileInput,
  outputSchema: importFileResult,
  availableInSubagents: false,
  async execute(input, context) {
    const { current, initiator } = context.session.auth;
    if (
      context.session.parent ||
      current?.authenticator !== "chatjs-gateway" ||
      current.principalId !== initiator?.principalId
    ) {
      throw new Error(
        "File import requires the current ChatJS conversation owner's authority."
      );
    }
    const { ownerId, branchId } = await resolveEveConversationScope(
      current.principalId,
      context.session.id,
      context.abortSignal
    );
    return await withEveConversationFile(
      ownerId,
      branchId,
      input.fileId,
      async () =>
        await importStoredFile(input, {
          stat: async () => await getFileMetadata(input.fileId),
          read: async () => await downloadFile(input.fileId),
          getSandbox: async () => await context.getSandbox(),
          signal: context.abortSignal,
        })
    );
  },
  toModelOutput: (output) => toolOutput.json(output),
});
