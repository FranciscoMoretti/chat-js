"use server";

import { fetchChatModels } from "@/lib/ai/app-models";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (getChatModels); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve getChatModels's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types --
 * typescript/explicit-function-return-type (#560): Keep getChatModels's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep getChatModels's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 */
export const getChatModels = async () => await fetchChatModels();
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */
