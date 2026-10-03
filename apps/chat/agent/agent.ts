/* oxlint-disable import/no-relative-parent-imports, sort-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../lib/eve/environment"; "../lib/eve/model-selection"; "../lib/eve/tool-availability"; "../lib/eve/world-config" dependency within this package instead of introducing an alias or barrel API.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import { wrapLanguageModel } from "ai";
import { defineAgent, defineDynamic } from "eve";
import { defineState } from "eve/context";

import { configureWorkflowEnvironment } from "../lib/eve/environment";
import { resolveEveModel } from "../lib/eve/model-selection";
import { installedToolAvailabilityMiddleware } from "../lib/eve/tool-availability";
import { resolveWorkflowWorld } from "../lib/eve/world-config";
/* oxlint-enable import/no-relative-parent-imports, sort-imports */

/* oxlint-disable node/no-process-env --
 * node/no-process-env (#537): configureWorkflowEnvironment reads process.env at the environment/configuration boundary; moving this access requires preserving runtime and test override behavior.
 */
configureWorkflowEnvironment(process.env);
/* oxlint-enable node/no-process-env */

const selectedModel = defineState<{ modelId?: string }>(
  "chatjs.turn-model",
  () => ({})
);

/* oxlint-disable import/no-default-export, oxc/no-async-await, oxc/no-optional-chaining, oxc/no-rest-spread-properties, typescript/prefer-readonly-parameter-types --
 * import/no-default-export (#526): Preserve the existing default export import contract; converting its consumers requires a public module API migration.
 * oxc/no-async-await (#540): default export sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * oxc/no-optional-chaining (#542): default export handles optional context.session.auth.current?.attributes.modelId without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 * oxc/no-rest-spread-properties (#543): default export copies or separates ...resolved while preserving existing object ownership; mutating source objects is not equivalent.
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
        const modelId = context.session.auth.current?.attributes.modelId;
        if (typeof modelId === "string") {
          selectedModel.update(() => ({ modelId }));
        }
        const resolved = await resolveEveModel(selectedModel.get().modelId);
        return {
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
/* oxlint-enable import/no-default-export, oxc/no-async-await, oxc/no-optional-chaining, oxc/no-rest-spread-properties, typescript/prefer-readonly-parameter-types */
