import { defineState } from "eve/context";

import type { eveImageContext } from "./image-context";

// Only image references needed by the next tool call enter durable state.
export const eveToolImageContext = defineState<
  ReturnType<typeof eveImageContext>
>("chatjs.tool-image-context", () => ({
  attachments: [],
  lastGeneratedImage: null,
}));
