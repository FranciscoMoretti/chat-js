import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { getCodeSandboxCleanup } from "@/lib/ai/installed-tool-capabilities";
import { tools } from "@/tools/chatjs/tools";

import {
  listEveCodeSandboxesForDeletion,
  recordEveCodeSandboxDeletion,
} from "../db/eve-code-sandboxes";
import { eveCodeSandboxName } from "./code-sandbox-name";

const NO_RESOURCES = 0;
const ENTRY_VALUE_INDEX = 1;

type CodeSandboxCleanupSession = ReturnType<
  NonNullable<ReturnType<typeof getCodeSandboxCleanup>>["createCleanupSession"]
>;

type CodeSandboxDeletionResource = Awaited<
  ReturnType<typeof listEveCodeSandboxesForDeletion>
>[number];

const assertNoUncertainCodeSandboxes = (
  resources: readonly CodeSandboxDeletionResource[]
): void => {
  if (resources.length > NO_RESOURCES) {
    throw new Error(
      "Resolve uncertain code sandbox creation before completing deletion."
    );
  }
};

const createCodeSandboxCleanupSession = (): CodeSandboxCleanupSession => {
  const capability = getCodeSandboxCleanup(
    Object.entries(tools).find(
      ([name]: readonly [string, ...unknown[]]) => name === "codeExecution"
    )?.[ENTRY_VALUE_INDEX]
  );
  if (!capability) {
    throw new Error(
      "Install the code execution tool to clean up its durable sandbox resources."
    );
  }
  return capability.createCleanupSession();
};

const purgeConfirmedCodeSandbox = async (
  ownerId: string,
  resource: Readonly<
    Awaited<ReturnType<typeof listEveCodeSandboxesForDeletion>>[number]
  >,
  cleanup: ReadonlyNativeSurface<CodeSandboxCleanupSession>
): Promise<void> => {
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
  await cleanup.deleteAndConfirmAbsent(resource.name);
  await recordEveCodeSandboxDeletion(
    ownerId,
    resource.conversationId,
    resource.name
  );
};

/**
 * Delete confirmed family sandboxes and release ownership only after confirmed absence.
 * Native work must already be retired. Uncertain creation intents prevent completion.
 * @param {string} ownerId - Authorized owner used to read and retire durable sandbox allocations.
 * @param {string} rootId - Conversation-family root whose sandbox allocations are being purged.
 */
export const purgeEveFamilyCodeSandboxes = async (
  ownerId: string,
  rootId: string
): Promise<void> => {
  const resources = await listEveCodeSandboxesForDeletion(ownerId, rootId);
  const confirmedResources = resources.filter(
    (resource) => resource.creationConfirmed
  );
  if (confirmedResources.length === NO_RESOURCES) {
    assertNoUncertainCodeSandboxes(resources);
    return;
  }
  const cleanup = createCodeSandboxCleanupSession();
  for (const resource of confirmedResources) {
    // Keep identity verification, provider absence, and durable release as one ordered unit per resource.
    // oxlint-disable-next-line eslint/no-await-in-loop -- The shared provider cleanup session verifies identity, proves absence, and durably releases one resource before the next; a failed resource must retain later ownership.
    await purgeConfirmedCodeSandbox(ownerId, resource, cleanup);
  }
  if (resources.some((resource) => !resource.creationConfirmed)) {
    throw new Error(
      "Resolve uncertain code sandbox creation before completing deletion."
    );
  }
};
