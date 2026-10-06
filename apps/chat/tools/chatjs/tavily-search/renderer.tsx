"use client";
import React from "react";

import { WebSearch } from "@/components/part/web-search";
/* oxlint-disable sort-imports -- Oxfmt groups type imports by source path, while the native rule orders their bindings differently; both imports erase at runtime. */
import type { ToolRendererProps } from "@/lib/ai/define-tool-renderer";
import { defineToolRenderer } from "@/lib/ai/define-tool-renderer";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
/* oxlint-enable sort-imports */

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { webSearchInput, webSearchResult } from "./schemas";
/* oxlint-enable sort-imports */

/* oxlint-disable react/only-export-components -- Registry consumers require the colocated render helper or metadata exports; the published module is not solely a Fast Refresh boundary. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
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
}>) => <WebSearch messageId={messageId} part={tool} />;
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (WebSearchRenderer); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable react/only-export-components */

export const WebSearchRenderer = defineToolRenderer({
  inputSchema: webSearchInput,
  outputSchema: webSearchResult,
  render: WebSearchView,
});
/* oxlint-enable import/prefer-default-export, import/no-named-export */
