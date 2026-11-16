"use client";
import React from "react";
import { FileArtifactCard } from "@/components/file-artifact-card";
import { defineToolRenderer } from "@/chatjs/core/tools/define-renderer";
import { attachWorkspaceFileInput, attachWorkspaceFileResult } from "./schemas";

export const AttachWorkspaceFileRenderer = defineToolRenderer({
  inputSchema: attachWorkspaceFileInput,
  outputSchema: attachWorkspaceFileResult,
  render: ({ tool }) =>
    tool.state === "output-available" ? (
      <FileArtifactCard artifact={tool.output} />
    ) : (
      <output className="text-muted-foreground block rounded-lg border p-4 text-sm">
        Preparing download
        {tool.input?.name === undefined ? "…" : `: ${tool.input.name}`}
      </output>
    ),
});
