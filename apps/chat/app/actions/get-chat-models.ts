"use server";

import { fetchChatModels } from "@/lib/ai/app-models";

export const getChatModels = async (): ReturnType<typeof fetchChatModels> =>
  await fetchChatModels();
