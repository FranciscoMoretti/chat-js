import { getCodeSandboxCleanup } from "@/lib/ai/installed-tool-capabilities";
import { tools } from "@/tools/chatjs/tools";

/* oxlint-disable import/no-relative-parent-imports -- Preserve user-owned custom tool initialization before environment validation and database-client creation; alias sorting moves this database dependency before the installed registry and changes that supported extension startup order. */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  listEveCodeSandboxesForDeletion,
  recordEveCodeSandboxDeletion,
} from "../db/eve-code-sandboxes";
/* oxlint-enable sort-imports */
/* oxlint-enable import/no-relative-parent-imports */
import { eveCodeSandboxName } from "./code-sandbox-name";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (purgeEveFamilyCodeSandboxes); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve purgeEveFamilyCodeSandboxes's awaited sequencing and rejected-Promise behavior. */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, no-undefined, typescript/prefer-readonly-parameter-types --
 * max-lines-per-function (#510): purgeEveFamilyCodeSandboxes keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): purgeEveFamilyCodeSandboxes keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): purgeEveFamilyCodeSandboxes uses 0, 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * no-undefined (#519): purgeEveFamilyCodeSandboxes uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * typescript/prefer-readonly-parameter-types (#565): purgeEveFamilyCodeSandboxes accepts [name]; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
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
  if (confirmedResources.length === 0) {
    if (resources.length > 0) {
      throw new Error(
        "Resolve uncertain code sandbox creation before completing deletion."
      );
    }
    return;
  }
  const capability = getCodeSandboxCleanup(
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading 1 from Object.entries(...).find(...); preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
    Object.entries(tools).find(([name]) => name === "codeExecution")?.[1]
  );
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
    // eslint-disable-next-line no-await-in-loop -- Confirm provider absence before releasing durable ownership for each sandbox; cleanup and deletion recording must remain ordered.
    await cleanup.deleteAndConfirmAbsent(resource.name);
    // Release durable ownership only after provider absence is confirmed.
    // eslint-disable-next-line no-await-in-loop -- Confirm provider absence before releasing durable ownership for each sandbox; cleanup and deletion recording must remain ordered.
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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, no-undefined, typescript/prefer-readonly-parameter-types */
