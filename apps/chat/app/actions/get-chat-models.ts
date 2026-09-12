"use server";

import { fetchChatModels } from "@/lib/ai/app-models";

export const getChatModels = async () => await fetchChatModels();
