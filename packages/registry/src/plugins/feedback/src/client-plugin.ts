"use client";
import { definePlugin, slot } from "@/chatjs/core/ui/slots";
import { MessageActions } from "@/components/chat-slots";
import { FeedbackActions } from "./feedback-actions";

export const feedbackClient = definePlugin({
  id: "feedback",
  slots: [slot(MessageActions, FeedbackActions)],
});
