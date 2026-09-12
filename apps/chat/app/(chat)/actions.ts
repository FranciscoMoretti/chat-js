"use server";

import { generateText } from "ai";

import { getLanguageModel } from "@/lib/ai/providers";
import { chatTelemetry } from "@/lib/ai/telemetry";
import type { ChatMessage } from "@/lib/ai/types";
import { config } from "@/lib/config";

export async function generateTitleFromUserMessage({
  message,
}: {
  message: ChatMessage;
}) {
  const { text: title } = await generateText({
    instructions: `Generate a concise title for a chat conversation based on the user's first message.

Rules (strictly follow all):
- Maximum 40 characters — hard limit, never exceed this
- 3-6 words is ideal
- No quotes, colons, or punctuation at the end
- No filler words like "How to" or "Question about"
- Use title case
- Return ONLY the title, nothing else`,
    model: await getLanguageModel(config.ai.workflows.title),
    prompt: JSON.stringify(message),
    telemetry: { integrations: chatTelemetry, isEnabled: true },
  });

  return title;
}
