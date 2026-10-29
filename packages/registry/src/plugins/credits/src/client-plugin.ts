"use client";
import { definePlugin } from "@/lib/ui-slots";
import { AccountSummary } from "@/components/chat-slots";
import { CreditBalance } from "./balance";

export const creditsClient = definePlugin({
  id: "credits",
  contributions: [AccountSummary.contribute(CreditBalance)],
});
