import { defineTool, toolOutput } from "eve/tools";
import { resolveEveConversationScope } from "@/lib/eve/conversation-scope";
import { publishConversationFile } from "./publish-conversation-file";
import {
  publishFileInput,
  publishFileResult,
  importFileInput,
  importFileResult,
} from "./schemas";
import { importStoredFile } from "./import";
import { withEveConversationFile } from "@/lib/db/eve-files";
import { downloadFile, getFileMetadata } from "@/lib/file-storage";

export const publish_file = defineTool({
  description:
    "Publish a finished sandbox file as a downloadable ChatJS artifact. Creates a new durable snapshot; later sandbox edits do not change it. Use for user-requested deliverables, not intermediate files. To revise an earlier artifact, import_file using its exact fileId, edit the workspace copy with native tools, then publish_file again. Earlier downloads remain unchanged. Maximum 32 MiB. Delegated agents return the file path to the parent for publication.",
  inputSchema: publishFileInput,
  outputSchema: publishFileResult,
  availableInSubagents: false,
  async execute(input, context) {
    return await publishConversationFile(input, context);
  },
  toModelOutput: (output) => toolOutput.json(output),
});

export const import_file = defineTool({
  description:
    "Import a published artifact or uploaded file referenced in the current ChatJS conversation into the current EVE workspace. Use before revising an earlier file, including after its original sandbox is gone. Supply its exact fileId and filename from conversation history; ask the user to identify or upload the file if ambiguous. Returns a fresh local copy. Edit it with native tools and publish_file to deliver a new snapshot. The original is never changed. Maximum 32 MiB.",
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
    const { ownerId, conversationId } = await resolveEveConversationScope(
      current.principalId,
      context.session.id,
      context.abortSignal
    );
    return await withEveConversationFile(
      ownerId,
      conversationId,
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
