"use client";
import { definePlugin } from "@/lib/ui-slots";
import { MessageActions } from "@/components/chat-slots";
import { FeedbackActions } from "./feedback-actions";

export const feedbackClient = definePlugin({
  id: "feedback",
  contributions: [MessageActions.contribute(FeedbackActions)],
});
