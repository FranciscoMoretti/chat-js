import type { ChatClientIntegration } from "@/lib/chat-plugin-contracts";
import type { ContributionPlacement } from "@/lib/compose-contributions";

/** Placement uses plugin IDs, without importing optional implementations. */
export const chatUiPlacement: Partial<
  Record<keyof ChatClientIntegration, ContributionPlacement>
> = {};

/** Local contributions override only the supplied slots when plugin IDs match. */
export const customChatUi: readonly {
  id: string;
  chat: ChatClientIntegration;
}[] = [];
