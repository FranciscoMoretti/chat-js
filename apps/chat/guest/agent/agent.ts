/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../../lib/eve/disposable-guest"; "../../lib/eve/model-selection" dependency within this package instead of introducing an alias or barrel API.
 */
import { defineAgent, defineDynamic } from "eve";

import { GUEST_SESSION_DURATION_MS } from "../../lib/eve/disposable-guest";
import { resolveEveModel } from "../../lib/eve/model-selection";
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable import/no-default-export, typescript/prefer-readonly-parameter-types, typescript/promise-function-async  --
 * import/no-default-export (#526): Preserve the existing default export import contract; converting its consumers requires a public module API migration.
 * oxc/no-optional-chaining (#542): default export handles optional context.session.auth.initiator?.attributes.modelId without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 * typescript/prefer-readonly-parameter-types (#565): default export accepts context; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): default export preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
export default defineAgent({
  defaultTools: false,
  // Disposable guests use Vercel Workflow when deployed and isolated local storage
  // in development. Sharing the registered agent's PostgreSQL queue is unsafe.
  experimental: { workflow: { retention: 0 } },
  limits: { sessionTimeoutMs: GUEST_SESSION_DURATION_MS },
  model: defineDynamic({
    events: {
      "step.started": (_event, context) => {
        const modelId = context.session.auth.initiator?.attributes.modelId;
        if (typeof modelId !== "string") {
          throw new TypeError("Guest session has no authorized model.");
        }
        return resolveEveModel(modelId);
      },
    },
  }),
});
/* oxlint-enable import/no-default-export, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */
