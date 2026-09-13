import type { ToolSet } from "ai";

import { getCodeSandboxCleanup } from "../ai/installed-tool-capabilities";
import { installedTools } from "../ai/installed-tools";
import {
  listEveCodeSandboxesForDeletion,
  recordEveCodeSandboxDeletion,
} from "../db/eve-code-sandboxes";
import { eveCodeSandboxName } from "./code-sandbox-name";

const registeredTools: ToolSet = installedTools;

/** Native work must already be retired. Never infer a failed create from provider absence. */
export const purgeEveFamilyCodeSandboxes = async (
  ownerId: string,
  rootId: string
) => {
  const resources = await listEveCodeSandboxesForDeletion(ownerId, rootId);
  const confirmedResources = resources.filter(
    (resource) => resource.creationConfirmed
  );
  if (confirmedResources.length === 0) {
    if (resources.length > 0) {
      throw new Error(
        "Resolve uncertain code sandbox creation before completing deletion."
      );
    }
    return;
  }
  const capability = getCodeSandboxCleanup(registeredTools.codeExecution);
  if (!capability) {
    throw new Error(
      "Install the code execution tool to clean up its durable sandbox resources."
    );
  }
  const cleanup = capability.createCleanupSession();
  for (const resource of confirmedResources) {
    if (
      eveCodeSandboxName({
        callId: resource.callId,
        ownerId,
        provider: cleanup.provider,
        sessionId: resource.sessionId ?? undefined,
      }) !== resource.name
    ) {
      throw new Error(
        "Code sandbox provider scope does not match its allocation intent."
      );
    }
    // Cleanup and absence confirmation form one ordered provider transaction.
    // eslint-disable-next-line no-await-in-loop
    await cleanup.deleteAndConfirmAbsent(resource.name);
    // Release durable ownership only after provider absence is confirmed.
    // eslint-disable-next-line no-await-in-loop
    await recordEveCodeSandboxDeletion(
      ownerId,
      resource.conversationId,
      resource.name
    );
  }
  if (resources.some((resource) => !resource.creationConfirmed)) {
    throw new Error(
      "Resolve uncertain code sandbox creation before completing deletion."
    );
  }
};
