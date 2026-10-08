/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../../lib/eve/image-context"; "../../lib/eve/tool-image-context"; "../../lib/eve/turn-tools"; "../../tools/chatjs/tools" dependency within this package instead of introducing an alias or barrel API.
 */
import { defineDynamic } from "eve/tools";

import { eveImageContext } from "../../lib/eve/image-context";
import { eveToolImageContext } from "../../lib/eve/tool-image-context";
import { filterEveTools } from "../../lib/eve/turn-tools";
import { tools } from "../../tools/chatjs/tools";
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable import/no-default-export -- import/no-default-export (#526): Preserve the existing default export import contract; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */

export default defineDynamic({
  events: {
    "step.started": (
      _event: unknown,
      // oxlint-disable-next-line no-magic-numbers -- The numeric index selects the original callback parameter in this type-only lookup; it does not add a runtime constant.
      context: Readonly<{ messages: Parameters<typeof eveImageContext>[0] }>
    ) => {
      const images = eveImageContext(context.messages);
      eveToolImageContext.update(() => images);
      return filterEveTools(tools);
    },
  },
});
/* oxlint-enable import/no-default-export */
