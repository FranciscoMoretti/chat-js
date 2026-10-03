"use client";
import React from "react";

import { WebSearch } from "@/components/part/web-search";
import type { ToolRendererProps } from "@/lib/ai/define-tool-renderer";
import { defineToolRenderer } from "@/lib/ai/define-tool-renderer";

import { webSearchInput, webSearchResult } from "./schemas";

/* oxlint-disable react/only-export-components -- Registry consumers require the colocated render helper or metadata exports; the published module is not solely a Fast Refresh boundary. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const WebSearchView = ({
  tool,
  messageId,
}: {
  tool: ToolRendererProps<
    typeof webSearchInput,
    typeof webSearchResult
  >["tool"];
  messageId: string;
  isReadonly: boolean;
}) => <WebSearch messageId={messageId} part={tool} />;
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable react/only-export-components */

export const WebSearchRenderer = defineToolRenderer({
  inputSchema: webSearchInput,
  outputSchema: webSearchResult,
  render: WebSearchView,
});
