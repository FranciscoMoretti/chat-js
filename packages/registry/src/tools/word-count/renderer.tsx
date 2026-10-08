"use client";
import { wordCountInput, wordCountResult } from "./schemas";
import React from "react";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import type { ToolRendererProps } from "@/lib/ai/define-tool-renderer";
import { defineToolRenderer } from "@/lib/ai/define-tool-renderer";

type WordCountRendererTool = ToolRendererProps<
  typeof wordCountInput,
  typeof wordCountResult
>["tool"];

/* oxlint-disable react/only-export-components -- Registry consumers require the colocated render helper or metadata exports; the published module is not solely a Fast Refresh boundary. */
const Stat = ({
  label,
  value,
}: Readonly<{ label: string; value: number }>): React.JSX.Element => (
  <div className="flex flex-col items-center gap-1">
    <span className="text-lg font-semibold">{value}</span>
    <span className="text-muted-foreground text-xs">{label}</span>
  </div>
);
/* oxlint-disable react/jsx-no-literals -- WordCountView renders authored tool output labels, status copy and display punctuation; no translation-layer contract is defined here. */
/* oxlint-enable react/only-export-components */

/* oxlint-disable react/no-multi-comp -- These private render helpers belong to the same UI composition and share its local types and state assumptions. */
/* oxlint-disable react/only-export-components -- Registry consumers require the colocated render helper or metadata exports; the published module is not solely a Fast Refresh boundary. */

/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
/* oxlint-disable typescript/strict-boolean-expressions -- This value-producing condition preserves the current nullish/empty sentinel behavior; coercing it would change the returned value. */
const WordCountView = ({
  tool,
}: ReadonlyNativeSurface<{
  tool: WordCountRendererTool;
  messageId: string;
  isReadonly: boolean;
}>): React.JSX.Element | null => {
  if (tool.state === "input-available") {
    return (
      <div className="text-muted-foreground rounded-lg border p-3 text-sm">
        Counting words...
      </div>
    );
  }

  if (tool.state !== "output-available") {
    return null;
  }

  if (!tool.output) {
    return null;
  }

  const { words, characters, charactersNoSpaces, sentences } = tool.output;

  return (
    <div className="grid grid-cols-2 gap-2 rounded-lg border p-3 text-sm sm:grid-cols-4">
      <Stat label="Words" value={words} />
      <Stat label="Characters" value={characters} />
      <Stat label="No spaces" value={charactersNoSpaces} />
      <Stat label="Sentences" value={sentences} />
    </div>
  );
};
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (WordCountRenderer); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable unicorn/no-null */

/* oxlint-enable react/only-export-components */
/* oxlint-enable react/no-multi-comp */

export const WordCountRenderer = defineToolRenderer({
  inputSchema: wordCountInput,
  outputSchema: wordCountResult,
  render: WordCountView,
});
/* oxlint-enable import/prefer-default-export, import/no-named-export */
