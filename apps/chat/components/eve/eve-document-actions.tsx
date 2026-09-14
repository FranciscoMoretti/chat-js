"use client";

import { Copy, History } from "lucide-react";
import { parse, unparse } from "papaparse";
import { toast } from "sonner";

import {
  ArtifactAction,
  ArtifactActions,
} from "@/components/ai-elements/artifact";

export const EveDocumentActions = ({
  kind,
  content,
  canCompare,
  comparing,
  onCompare,
}: {
  kind: "text" | "code" | "sheet";
  content: string;
  canCompare: boolean;
  comparing: boolean;
  onCompare: () => void;
}) => {
  const copy = async () => {
    try {
      let copied = content;
      if (kind === "sheet") {
        const parsed = parse<string[]>(content, { skipEmptyLines: true });
        copied = unparse(
          parsed.data.filter((row) => row.some((cell) => cell.trim() !== ""))
        );
      }
      await navigator.clipboard.writeText(copied);
      toast.success("Copied to clipboard!");
    } catch {
      toast.error(
        "Could not copy. Check your browser's clipboard permissions."
      );
    }
  };
  return (
    <ArtifactActions className="shrink-0">
      {kind === "text" && (
        <ArtifactAction
          aria-pressed={comparing}
          disabled={!canCompare}
          icon={History}
          onClick={onCompare}
          tooltip={comparing ? "Show document" : "View changes"}
        />
      )}
      <ArtifactAction
        icon={Copy}
        onClick={copy}
        tooltip={kind === "sheet" ? "Copy as CSV" : "Copy to clipboard"}
      />
    </ArtifactActions>
  );
};
