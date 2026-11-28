"use client";

import { definePlugin, slot } from "@/chatjs/core/ui/slots";
import { MessageResponses } from "@/components/chat-slots";
import { ParallelResponses } from "./responses";

export const chatUi = definePlugin({
  id: "parallel-responses",
  slots: [slot(MessageResponses, ParallelResponses)],
});
