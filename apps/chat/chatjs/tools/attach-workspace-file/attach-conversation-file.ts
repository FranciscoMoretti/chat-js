import type { WorkflowStepToolContext } from "eve/tools";
import type { z } from "zod";
import { eveGeneratedFileUploader } from "@/lib/eve/generated-files";
import { resolveEveConversationScope } from "@/lib/eve/conversation-scope";
import { attachSandboxFile } from "./attach";
import type { attachWorkspaceFileInput } from "./schemas";

/** Application boundary shared by tools and durable workflows publishing sandbox files. */
export const attachConversationFile = async (
  input: z.infer<typeof attachWorkspaceFileInput>,
  context: Readonly<WorkflowStepToolContext>
) => {
  const { current, initiator } = context.session.auth;
  if (
    context.session.parent ||
    current?.authenticator !== "chatjs-gateway" ||
    current.principalId !== initiator?.principalId
  ) {
    throw new Error(
      "Publication requires the current ChatJS conversation owner's authority."
    );
  }
  // Authorize the application resource before reading sandbox bytes.
  await resolveEveConversationScope(
    current.principalId,
    context.session.id,
    context.abortSignal
  );
  return await attachSandboxFile(input, {
    sandbox: await context.getSandbox(),
    upload: eveGeneratedFileUploader(context),
    signal: context.abortSignal,
  });
};
