"use client";
import { webSearchInput, webSearchResult } from "./schemas";
import React from "react";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import type { ToolRendererProps } from "@/lib/ai/define-tool-renderer";
import { WebSearch } from "@/components/part/web-search";
import { defineToolRenderer } from "@/lib/ai/define-tool-renderer";

/* oxlint-disable react/only-export-components -- Registry consumers require the colocated render helper or metadata exports; the published module is not solely a Fast Refresh boundary. */
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
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (WebSearchRenderer); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-enable react/only-export-components */

export const WebSearchRenderer = defineToolRenderer({
  inputSchema: webSearchInput,
  outputSchema: webSearchResult,
  render: WebSearchView,
});
/* oxlint-enable import/prefer-default-export, import/no-named-export */
