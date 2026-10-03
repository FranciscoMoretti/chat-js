import { defineState } from "eve/context";

import type { eveImageContext } from "./image-context";

/* oxlint-disable unicorn/no-null  --
 * import/no-named-export (#527): Preserve the named eveToolImageContext API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * import/prefer-default-export (#532): eveToolImageContext remains a named API, consistent with no-default-export; adding future exports must not change caller import syntax.
 * unicorn/no-null (#570): eveToolImageContext preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
// Only image references needed by the next tool call enter durable state.
export const eveToolImageContext = defineState<
  ReturnType<typeof eveImageContext>
>("chatjs.tool-image-context", () => ({
  attachments: [],
  lastGeneratedImage: null,
}));
/* oxlint-enable unicorn/no-null */
