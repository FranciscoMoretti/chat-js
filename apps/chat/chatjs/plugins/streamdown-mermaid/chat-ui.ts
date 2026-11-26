"use client";

import { mermaid } from "@streamdown/mermaid";
import { definePlugin } from "@/chatjs/core/ui/slots";

export const chatUi = definePlugin({
  id: "streamdown-mermaid",
  slots: [],
  streamdown: { mermaid },
});
