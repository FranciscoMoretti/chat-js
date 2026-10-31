"use client";

import { toolDefinition } from "./definition";
import type { wordCountInput, wordCountResult } from "./schemas";
import React from "react";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import type { ToolRendererProps } from "@/chatjs/core/tools/define-renderer";
import { defineToolRenderer } from "@/chatjs/core/tools/define-renderer";

type WordCountRendererTool = ToolRendererProps<
  typeof wordCountInput,
  typeof wordCountResult
>["tool"];

const Stat = ({
  label,
  value,
}: Readonly<{ label: string; value: number }>): React.JSX.Element => (
  <div className="flex flex-col items-center gap-1">
    <span className="text-lg font-semibold">{value}</span>
    <span className="text-muted-foreground text-xs">{label}</span>
  </div>
);

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

  if (tool.output === undefined) {
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

export const WordCountRenderer = defineToolRenderer({
  inputSchema: toolDefinition.inputSchema,
  outputSchema: toolDefinition.outputSchema,
  render: WordCountView,
});
