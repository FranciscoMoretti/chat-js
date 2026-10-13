"use client";
import { webSearchInput, webSearchResult } from "./schemas";
import React from "react";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import type { ToolRendererProps } from "@/lib/ai/define-tool-renderer";
import { WebSearch } from "@/components/part/web-search";
import { defineToolRenderer } from "@/lib/ai/define-tool-renderer";

const WebSearchView = ({
  tool,
  messageId,
}: ReadonlyNativeSurface<{
  tool: ToolRendererProps<
    typeof webSearchInput,
    typeof webSearchResult
  >["tool"];
  messageId: string;
  isReadonly: boolean;
}>): React.JSX.Element => <WebSearch messageId={messageId} part={tool} />;

export const WebSearchRenderer = defineToolRenderer({
  inputSchema: webSearchInput,
  outputSchema: webSearchResult,
  render: WebSearchView,
});
