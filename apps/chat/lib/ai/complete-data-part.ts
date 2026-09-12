"use client";

import type { AbstractThread } from "@chat-js/thread";
import { safeValidateUIMessages } from "ai";
import type { DataUIPart } from "ai";
import { z } from "zod";

import { messageMetadataSchema } from "@/lib/ai/types";
import type { ChatMessage, CustomUIDataTypes } from "@/lib/ai/types";

const serializedMessageMetadataSchema = messageMetadataSchema.extend({
  createdAt: z.coerce.date(),
});
const serializedMessageSchema = z
  .object({ metadata: serializedMessageMetadataSchema })
  .passthrough();

export const parseAppendedMessage = async (
  data: string
): Promise<ChatMessage | null> => {
  let value: unknown;
  try {
    value = JSON.parse(data);
  } catch {
    return null;
  }

  const serializedMessage = serializedMessageSchema.safeParse(value);
  if (!serializedMessage.success) {
    return null;
  }

  const result = await safeValidateUIMessages<ChatMessage>({
    messages: [serializedMessage.data],
    metadataSchema: messageMetadataSchema,
  });
  return result.success ? (result.data[0] ?? null) : null;
};

export const completeDataPart = async ({
  dataPart,
  thread,
}: {
  dataPart: DataUIPart<CustomUIDataTypes>;
  thread: Pick<AbstractThread<ChatMessage>, "upsertMessage">;
}) => {
  if (dataPart.type !== "data-appendMessage") {
    return;
  }

  const message = await parseAppendedMessage(dataPart.data);
  if (message) {
    thread.upsertMessage(message, message.metadata.parentMessageId);
  }
};
