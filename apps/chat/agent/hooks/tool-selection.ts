/* oxlint-disable import/no-relative-parent-imports, sort-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../../lib/ai/types"; "../../lib/eve/turn-tools" dependency within this package instead of introducing an alias or barrel API.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import { defineHook } from "eve/hooks";

import { frontendToolsSchema } from "../../lib/ai/types";
import { eveTurnGuest, eveTurnTool } from "../../lib/eve/turn-tools";
/* oxlint-enable import/no-relative-parent-imports, sort-imports */

/* oxlint-disable import/no-default-export, no-ternary, no-undefined, oxc/no-optional-chaining, typescript/prefer-readonly-parameter-types, unicorn/no-null --
 * import/no-default-export (#526): Preserve the existing default export import contract; converting its consumers requires a public module API migration.
 * no-ternary (#518): default export derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * no-undefined (#519): default export uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * oxc/no-optional-chaining (#542): default export handles optional context.session.auth.current?.attributes.chatjsGuest; context.session.auth.current?.attributes.selectedTool without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 * typescript/prefer-readonly-parameter-types (#565): default export accepts _event; context; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * unicorn/no-null (#570): default export preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
export default defineHook({
  events: {
    "turn.started": (_event, context) => {
      eveTurnGuest.update(
        () => context.session.auth.current?.attributes.chatjsGuest === "true"
      );
      const supplied = context.session.auth.current?.attributes.selectedTool;
      const selected =
        supplied === undefined ? null : frontendToolsSchema.parse(supplied);
      eveTurnTool.update(() => selected);
    },
  },
});
/* oxlint-enable import/no-default-export, no-ternary, no-undefined, oxc/no-optional-chaining, typescript/prefer-readonly-parameter-types, unicorn/no-null */
