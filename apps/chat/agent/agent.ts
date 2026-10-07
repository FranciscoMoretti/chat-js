/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../lib/eve/environment"; "../lib/eve/model-selection"; "../lib/eve/tool-availability"; "../lib/eve/world-config" dependency within this package instead of introducing an alias or barrel API.
 */
import { wrapLanguageModel } from "ai";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { defineAgent, defineDynamic } from "eve";
/* oxlint-enable sort-imports */
import { defineState } from "eve/context";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { configureWorkflowEnvironment } from "../lib/eve/environment";
/* oxlint-enable sort-imports */
import { resolveEveModel } from "../lib/eve/model-selection";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { installedToolAvailabilityMiddleware } from "../lib/eve/tool-availability";
/* oxlint-enable sort-imports */
import { resolveWorkflowWorld } from "../lib/eve/world-config";
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
/* oxlint-disable import/no-default-export, typescript/prefer-readonly-parameter-types --
 * import/no-default-export (#526): Preserve the existing default export import contract; converting its consumers requires a public module API migration.
 * typescript/prefer-readonly-parameter-types (#565): default export accepts context; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
export default defineAgent({
  build: { externalDependencies: ["pino", "pino-pretty", "thread-stream"] },
  // ChatJS owns tool selection, execution, rendered results, and usage accounting.
  defaultTools: false,
  experimental: { workflow: { world: resolveWorkflowWorld() } },
  model: defineDynamic({
    events: {
      "step.started": async (_event, context) => {
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
/* oxlint-enable import/no-default-export, typescript/prefer-readonly-parameter-types */
