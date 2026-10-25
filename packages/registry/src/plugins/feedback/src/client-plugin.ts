import type { ChatClientPlugin } from "@/lib/plugin-contracts";
import { FeedbackActions } from "./feedback-actions";

export const feedbackClient = () =>
  ({
    id: "feedback",
    chat: { MessageActions: FeedbackActions },
  }) satisfies ChatClientPlugin;
