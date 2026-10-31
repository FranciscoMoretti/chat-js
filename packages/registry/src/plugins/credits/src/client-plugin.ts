"use client";
import { definePlugin, slot } from "@/chatjs/core/ui/slots";
import { AccountSummary } from "@/components/chat-slots";
import { CreditBalance } from "./balance";

export const creditsClient = definePlugin({
  id: "credits",
  slots: [slot(AccountSummary, CreditBalance)],
});
