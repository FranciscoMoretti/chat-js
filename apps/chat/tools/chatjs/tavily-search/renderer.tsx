"use client";

import type { UIToolInvocation } from "ai";

import { WebSearch } from "@/components/part/web-search";
import { defineToolRenderer } from "@/lib/ai/define-tool-renderer";

import { webSearchInput, webSearchResult } from "./schemas";
import type { webSearch } from "./tool";

const WebSearchView = ({
  tool,
  messageId,
}: {
  tool: UIToolInvocation<typeof webSearch>;
  messageId: string;
  isReadonly: boolean;
}) => <WebSearch messageId={messageId} part={tool} />;

export const WebSearchRenderer = defineToolRenderer({
  inputSchema: webSearchInput,
  outputSchema: webSearchResult,
  render: WebSearchView,
});
