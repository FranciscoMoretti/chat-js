"use client";

import type { UIToolInvocation } from "ai";

import { WebSearch } from "@/components/part/web-search";

import type { webSearch } from "./tool";

export const WebSearchRenderer = ({
  tool,
  messageId,
}: {
  tool: UIToolInvocation<typeof webSearch>;
  messageId: string;
  isReadonly: boolean;
}) => <WebSearch messageId={messageId} part={tool} />;
