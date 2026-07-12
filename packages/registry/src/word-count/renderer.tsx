"use client";

import type { TypelessToolPartFromTool } from "@toolkit/lib/tool-part";
import type { wordCount } from "./tool";

type WordCountRendererTool = TypelessToolPartFromTool<typeof wordCount>;

export function WordCountRenderer({
  tool,
}: {
  tool: WordCountRendererTool;
  messageId: string;
  isReadonly: boolean;
}) {
  if (tool.state === "input-available") {
    return (
      <div className="rounded-lg border p-3 text-muted-foreground text-sm">
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
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="font-semibold text-lg">{value}</span>
      <span className="text-muted-foreground text-xs">{label}</span>
    </div>
  );
}
