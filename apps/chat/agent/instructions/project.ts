/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../../lib/eve/project-instructions" dependency within this package instead of introducing an alias or barrel API.
 */
import { defineDynamic, defineInstructions } from "eve/instructions";

import { projectInstructions } from "../../lib/eve/project-instructions";
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable import/no-default-export, typescript/strict-boolean-expressions, unicorn/no-null  --
 * import/no-default-export (#526): Preserve the existing default export import contract; converting its consumers requires a public module API migration.
 * no-ternary (#518): default export derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * typescript/strict-boolean-expressions (#610): default export intentionally keeps the existing falsy-value behavior of content; distinguishing empty, zero, and absent states requires a domain behavior decision.
 * unicorn/no-null (#570): default export preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
export default defineDynamic({
  events: {
    "turn.started": () => {
      const { content } = projectInstructions.get();
      return content
        ? defineInstructions({ content: `Project instructions:\n${content}` })
        : null;
    },
  },
});
/* oxlint-enable import/no-default-export, typescript/strict-boolean-expressions, unicorn/no-null */
