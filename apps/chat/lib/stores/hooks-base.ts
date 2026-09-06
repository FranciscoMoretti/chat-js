// Selected-path lists use the view; explicit message IDs read the shared tree.

import equal from "fast-deep-equal";
import { shallow } from "zustand/shallow";
import { useViewMessages, useViewSelector } from "@/lib/chat/view-hooks";
import type { ChatMessage } from "../ai/types";

export const useMessageIds = () =>
  useViewMessages((messages) => messages.map((message) => message.id), shallow);

export const useLastUsageUntilMessageId = (messageId: string | null) =>
  useViewMessages((messages) => {
    if (!messageId) {
      return;
    }
    const messageIdx = messages.findIndex((m) => m.id === messageId);
    if (messageIdx === -1) {
      return;
    }

    const sliced = messages.slice(0, messageIdx + 1);
    return sliced.findLast((m) => m.role === "assistant" && m.metadata?.usage)
      ?.metadata?.usage;
  }, shallow);

export const useMessageRoleById = (messageId: string): ChatMessage["role"] =>
  useViewSelector((state) => {
    const message = state.snapshot.messagesById[messageId];
    if (!message) {
      throw new Error(`Message not found for id: ${messageId}`);
    }
    return message.role;
  });

export const useMessagePartsById = (messageId: string): ChatMessage["parts"] =>
  useViewSelector((state) => {
    const message = state.snapshot.messagesById[messageId];
    if (!message) {
      throw new Error(`Message not found for id: ${messageId}`);
    }
    return message.parts;
  }, equal);

export const useMessageResearchUpdatePartsById = (
  messageId: string
): Extract<ChatMessage["parts"][number], { type: "data-researchUpdate" }>[] =>
  useViewSelector((state) => {
    const message = state.snapshot.messagesById[messageId];
    if (!message) {
      throw new Error(`Message not found for id: ${messageId}`);
    }
    return message.parts.filter((p) => p.type === "data-researchUpdate");
  }, equal);

export const useMessageMetadataById = (
  messageId: string
): ChatMessage["metadata"] =>
  useViewSelector((state) => {
    const message = state.snapshot.messagesById[messageId];
    if (!message) {
      throw new Error(`Message not found for id: ${messageId}`);
    }
    return message.metadata;
  }, shallow);

export const useLastMessageId = () =>
  useViewMessages((messages) => messages.at(-1)?.id ?? null);

export const useLastMessageMetadata = () =>
  useViewMessages((messages) => messages.at(-1)?.metadata, shallow);
