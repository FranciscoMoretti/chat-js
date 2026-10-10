/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../lib/eve/environment"; "../lib/eve/model-selection"; "../lib/eve/tool-availability"; "../lib/eve/world-config" dependency within this package instead of introducing an alias or barrel API.
 */
import { defineAgent, defineDynamic } from "eve";
import { configureWorkflowEnvironment } from "../lib/eve/environment";
import { defineState } from "eve/context";

import { resolveEveModel } from "../lib/eve/model-selection";
/* oxlint-disable sort-imports -- Sorting tool-availability before model-selection changes the first supported startup failure: an existing native chatjs.turn-tool codec collision precedes invalid environment validation; preserve the configuration-first contract. */
import { installedToolAvailabilityMiddleware } from "../lib/eve/tool-availability";
/* oxlint-enable sort-imports */
import { resolveWorkflowWorld } from "../lib/eve/world-config";
import { wrapLanguageModel } from "ai";
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable node/no-process-env --
 * node/no-process-env (#537): configureWorkflowEnvironment reads process.env at the environment/configuration boundary; moving this access requires preserving runtime and test override behavior.
 */
configureWorkflowEnvironment(process.env);
/* oxlint-enable node/no-process-env */

const selectedModel = defineState<{ modelId?: string }>(
  "chatjs.turn-model",
  () => ({})
);

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve callbacks in this statement's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable import/no-default-export -- import/no-default-export (#526): Preserve the existing default export import contract; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */

export default defineAgent({
  build: { externalDependencies: ["pino", "pino-pretty", "thread-stream"] },
  // ChatJS owns tool selection, execution, rendered results, and usage accounting.
  defaultTools: false,
  experimental: { workflow: { world: resolveWorkflowWorld() } },
  model: defineDynamic({
    events: {
      "step.started": async (
        _event: unknown,
        context: Readonly<{
          // oxlint-disable-next-line no-magic-numbers -- The numeric index selects the original callback parameter in this type-only lookup; it does not add a runtime constant.
          session: Parameters<typeof installedToolAvailabilityMiddleware>[0];
        }>
      ) => {
        // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading attributes from context.session.auth.current; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
        const modelId = context.session.auth.current?.attributes.modelId;
        if (typeof modelId === "string") {
          selectedModel.update(() => ({ modelId }));
        }
        const resolved = await resolveEveModel(selectedModel.get().modelId);
        return {
          // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing resolved own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
          ...resolved,
          model: wrapLanguageModel({
            middleware: installedToolAvailabilityMiddleware(context.session),
            model: resolved.model,
          }),
        };
      },
    },
  }),
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable import/no-default-export */
