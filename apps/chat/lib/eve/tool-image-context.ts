import { defineState } from "eve/context";

import type { eveImageContext } from "./image-context";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (eveToolImageContext); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable unicorn/no-null --
 * unicorn/no-null (#570): eveToolImageContext preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
// Only image references needed by the next tool call enter durable state.
export const eveToolImageContext = defineState<
  ReturnType<typeof eveImageContext>
>("chatjs.tool-image-context", () => ({
  attachments: [],
  lastGeneratedImage: null,
}));
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable unicorn/no-null */
