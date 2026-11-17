"use client";
import { definePlugin, slot } from "@/chatjs/core/ui/slots";
import { ArtifactViewerActions } from "@/components/artifact-actions";
import { SpreadsheetViewerAction } from "./viewer-action";

export const spreadsheetViewerClient = definePlugin({
  id: "spreadsheet-viewer",
  slots: [slot(ArtifactViewerActions, SpreadsheetViewerAction)],
});
