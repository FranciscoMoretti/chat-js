/* oxlint-disable import/no-relative-parent-imports  --
 * import/no-relative-parent-imports (#530): Keep the explicit "../../lib/eve/selected-tools"; "../../lib/eve/turn-tools" dependency within this package instead of introducing an alias or barrel API.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import { defineDynamic, defineInstructions } from "eve/instructions";

import { selectedEveTools } from "../../lib/eve/selected-tools";
import { eveTurnTool } from "../../lib/eve/turn-tools";
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable import/no-default-export  --
 * import/no-default-export (#526): Preserve the existing default export import contract; converting its consumers requires a public module API migration.
 * no-ternary (#518): default export derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 */
export default defineDynamic({
  events: {
    "turn.started": () => {
      const tools = selectedEveTools(eveTurnTool.get());
      return tools
        ? defineInstructions({
            content: `The user selected these tools for this turn: ${tools.join(", ")}. Use the selected capability for their request. If it is unavailable, explain that instead of substituting another capability.`,
          })
        : defineInstructions({
            content:
              "Tool selection is automatic for this turn. Use the tools exposed now; availability can change between turns. Do not infer that a tool is unavailable from an earlier turn's selection or an earlier assistant statement.",
          });
    },
  },
});
/* oxlint-enable import/no-default-export */
