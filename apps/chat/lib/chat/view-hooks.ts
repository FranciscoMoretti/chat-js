import { useStoreWithEqualityFn } from "zustand/traditional";
import { useConversationView } from "@/components/chat/conversation-view";
import type { ChatMessage } from "@/lib/ai/types";
import { type ConversationViewController, getViewMessages } from "./view-store";

export function useViewSelector<T>(
  selector: (
    state: ReturnType<ConversationViewController["store"]["getState"]>
  ) => T,
  equality?: (a: T, b: T) => boolean
) {
  return useStoreWithEqualityFn(
    useConversationView().store,
    selector,
    equality
  );
}
export const useChatId = () => useConversationView().thread.id;
export function useChatStatus() {
  const view = useConversationView();
  return useViewSelector(() => view.getRun()?.status ?? "ready");
}
export function useChatError() {
  const view = useConversationView();
  return useViewSelector(() => view.getRun()?.error);
}
export function useMessageById(messageId: string) {
  return useViewSelector((state) => state.snapshot.messagesById[messageId]);
}
export function useChatActions() {
  return useConversationView();
}
export function useViewMessages<T>(
  selector: (messages: ChatMessage[]) => T,
  equality?: (a: T, b: T) => boolean
) {
  return useViewSelector((state) => selector(getViewMessages(state)), equality);
}
