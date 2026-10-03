/* oxlint-disable import/no-relative-parent-imports  --
 * import/no-relative-parent-imports (#530): Keep the explicit "../../tools/chatjs/tools"; "../ai/installed-tool-capabilities"; "../db/eve-code-sandboxes" dependency within this package instead of introducing an alias or barrel API.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import { tools } from "../../tools/chatjs/tools";
import { getCodeSandboxCleanup } from "../ai/installed-tool-capabilities";
import {
  listEveCodeSandboxesForDeletion,
  recordEveCodeSandboxDeletion,
} from "../db/eve-code-sandboxes";
import { eveCodeSandboxName } from "./code-sandbox-name";
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable jsdoc/require-param, max-lines-per-function, max-statements, no-magic-numbers, no-undefined, typescript/prefer-readonly-parameter-types  --
 * import/no-named-export (#527): Preserve the named purgeEveFamilyCodeSandboxes API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * import/prefer-default-export (#532): purgeEveFamilyCodeSandboxes remains a named API, consistent with no-default-export; adding future exports must not change caller import syntax.
 * jsdoc/require-param (#534): purgeEveFamilyCodeSandboxes's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-lines-per-function (#510): purgeEveFamilyCodeSandboxes keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): purgeEveFamilyCodeSandboxes keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): purgeEveFamilyCodeSandboxes uses 0, 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * no-undefined (#519): purgeEveFamilyCodeSandboxes uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * oxc/no-async-await (#540): purgeEveFamilyCodeSandboxes sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * oxc/no-optional-chaining (#542): purgeEveFamilyCodeSandboxes handles optional Object.entries(tools).find(([name]) => name === "codeExecution")?.[1] without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 * typescript/prefer-readonly-parameter-types (#565): purgeEveFamilyCodeSandboxes accepts [name]; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
/** Native work must already be retired. Never infer a failed create from provider absence. */
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
/* oxlint-enable jsdoc/require-param, max-lines-per-function, max-statements, no-magic-numbers, no-undefined, typescript/prefer-readonly-parameter-types */
