/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../../lib/ai/prompts" dependency within this package instead of introducing an alias or barrel API.
 */
import { defineDynamic, defineInstructions } from "eve/instructions";

import { systemPrompt } from "../../lib/ai/prompts";
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable import/no-default-export --
 * import/no-default-export (#526): Preserve the existing default export import contract; converting its consumers requires a public module API migration.
 */
export default defineDynamic({
  events: {
    "turn.started": () =>
      defineInstructions({
        content: systemPrompt(),
      }),
  },
});
/* oxlint-enable import/no-default-export */
