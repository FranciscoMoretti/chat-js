"use client";

import { definePlugin, slot } from "@/chatjs/core/ui/slots";
import { MessageResponses } from "@/components/chat-slots";
import { ParallelResponses } from "./responses";

/** Local UI binding until response-group persistence and dispatch are extracted. */
export const parallelResponsesClient = definePlugin({
  id: "parallel-responses",
  slots: [slot(MessageResponses, ParallelResponses)],
});
