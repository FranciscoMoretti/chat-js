"use client";

import type { AbstractThread } from "@chatjs/thread";
import { type DataUIPart, safeValidateUIMessages } from "ai";
import { z } from "zod";
import {
  type ChatMessage,
  type CustomUIDataTypes,
  messageMetadataSchema,
} from "@/lib/ai/types";

const serializedMessageMetadataSchema = messageMetadataSchema.extend({
  createdAt: z.coerce.date(),
});
const serializedMessageSchema = z
  .object({ metadata: serializedMessageMetadataSchema })
  .passthrough();

export async function parseAppendedMessage(
  data: string
): Promise<ChatMessage | null> {
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
}

export async function completeDataPart({
  dataPart,
  thread,
}: {
  dataPart: DataUIPart<CustomUIDataTypes>;
  thread: Pick<AbstractThread<ChatMessage>, "upsertMessage">;
}) {
  if (dataPart.type !== "data-appendMessage") {
    return;
  }

  const message = await parseAppendedMessage(dataPart.data);
  if (message) {
    thread.upsertMessage(message, message.metadata.parentMessageId);
  }
}
