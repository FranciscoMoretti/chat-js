/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../../lib/ai/types"; "../../lib/eve/turn-tools" dependency within this package instead of introducing an alias or barrel API.
 */
import { defineHook } from "eve/hooks";

import { frontendToolsSchema } from "../../lib/ai/types";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { eveTurnGuest, eveTurnTool } from "../../lib/eve/turn-tools";
/* oxlint-enable sort-imports */
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable import/no-default-export, no-undefined, typescript/prefer-readonly-parameter-types, unicorn/no-null --
 * import/no-default-export (#526): Preserve the existing default export import contract; converting its consumers requires a public module API migration.
 * no-undefined (#519): default export uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * typescript/prefer-readonly-parameter-types (#565): default export accepts _event; context; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * unicorn/no-null (#570): default export preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
export default defineHook({
  events: {
    "turn.started": (_event, context) => {
      eveTurnGuest.update(
        // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading attributes from context.session.auth.current; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
        () => context.session.auth.current?.attributes.chatjsGuest === "true"
      );
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading attributes from context.session.auth.current; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
      const supplied = context.session.auth.current?.attributes.selectedTool;
      const selected =
        supplied === undefined ? null : frontendToolsSchema.parse(supplied);
      eveTurnTool.update(() => selected);
    },
  },
});
/* oxlint-enable import/no-default-export, no-undefined, typescript/prefer-readonly-parameter-types, unicorn/no-null */
