"use client";

import { defineToolRenderer } from "@/lib/ai/define-tool-renderer";
import type { ToolRendererProps } from "@/lib/ai/define-tool-renderer";

import { wordCountInput, wordCountResult } from "./schemas";

type WordCountRendererTool = ToolRendererProps<
  typeof wordCountInput,
  typeof wordCountResult
>["tool"];

const Stat = ({ label, value }: { label: string; value: number }) => (
  <div className="flex flex-col items-center gap-1">
    <span className="text-lg font-semibold">{value}</span>
    <span className="text-muted-foreground text-xs">{label}</span>
  </div>
);

const WordCountView = ({
  tool,
}: {
  tool: WordCountRendererTool;
  messageId: string;
  isReadonly: boolean;
}) => {
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

export const WordCountRenderer = defineToolRenderer({
  inputSchema: wordCountInput,
  outputSchema: wordCountResult,
  render: WordCountView,
});
