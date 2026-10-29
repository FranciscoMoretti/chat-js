"use client";
import { defineSlot } from "@/lib/ui-slots";
import type {
  ChatActionProps,
  ChatSuggestionsProps,
  ChatMessageActionProps,
} from "@/lib/chat-plugin-contracts";
import type { ComposerControlProps } from "@/components/composer/control";

export const SidebarSections = defineSlot();
export const SidebarHeaderItems = defineSlot<{ readonly ownerId?: string }>();
export const ChatActions = defineSlot<ChatActionProps>();
export const ChatBreadcrumbs = defineSlot<{ readonly chatId: string }>();
export const ChatHeaderActions = defineSlot<ChatActionProps>();
export const MessageActions = defineSlot<ChatMessageActionProps>();
export const ChatSuggestions = defineSlot<ChatSuggestionsProps>();
export const AccountSummary = defineSlot();
export const ComposerAttachments = defineSlot<ComposerControlProps>();
export const ComposerExtensions = defineSlot<ComposerControlProps>();
export const SettingsLinks = defineSlot();
export const ModelSettingsLink = defineSlot<{
  readonly surface: "sidebar" | "settings" | "picker";
}>();
