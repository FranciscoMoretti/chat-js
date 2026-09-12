"use client";
import type { UIToolInvocation } from "ai";

import { WebSearch } from "@/components/part/web-search";

import type { webSearch } from "./tool";
export function WebSearchRenderer({
  tool,
  messageId,
}: {
  tool: UIToolInvocation<typeof webSearch>;
  messageId: string;
  isReadonly: boolean;
}) {
  return <WebSearch messageId={messageId} part={tool} />;
}
