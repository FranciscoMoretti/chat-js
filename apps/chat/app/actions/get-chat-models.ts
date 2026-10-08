"use server";

import { fetchChatModels } from "@/lib/ai/app-models";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (getChatModels); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve getChatModels's awaited sequencing and rejected-Promise behavior. */
export const getChatModels = async (): ReturnType<typeof fetchChatModels> =>
  await fetchChatModels();
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
