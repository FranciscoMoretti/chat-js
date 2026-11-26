"use client";

import "katex/dist/katex.min.css";
import { math } from "@streamdown/math";
import { definePlugin } from "@/chatjs/core/ui/slots";

export const chatUi = definePlugin({
  id: "streamdown-math",
  slots: [],
  streamdown: { math },
});
