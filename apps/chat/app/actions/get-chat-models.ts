"use server";

import { fetchChatModels } from "@/lib/ai/app-models";

/* oxlint-disable import/no-named-export, import/prefer-default-export, oxc/no-async-await, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types --
 * import/no-named-export (#527): Preserve the named getChatModels API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * import/prefer-default-export (#532): getChatModels remains a named API, consistent with no-default-export; adding future exports must not change caller import syntax.
 * oxc/no-async-await (#540): getChatModels sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * typescript/explicit-function-return-type (#560): Keep getChatModels's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep getChatModels's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 */
export const getChatModels = async () => await fetchChatModels();
/* oxlint-enable import/no-named-export, import/prefer-default-export, oxc/no-async-await, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */
