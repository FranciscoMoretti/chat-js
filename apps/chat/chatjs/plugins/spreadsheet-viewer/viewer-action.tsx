"use client";
import { Table2Icon } from "lucide-react";
import { useEffect, useState } from "react";
import type { ArtifactReference } from "@/components/artifact-actions";
import { ArtifactDownloadAction } from "@/components/artifact-download-action";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { loadSpreadsheet, spreadsheetFormat } from "./load";
import { SpreadsheetPreview } from "./preview";
import type { SpreadsheetState } from "./preview";

const LoadedSpreadsheet = ({
  artifact,
}: {
  readonly artifact: ArtifactReference;
}) => {
  const { url, name, mediaType } = artifact;
  const [state, setState] = useState<SpreadsheetState>({ status: "loading" });
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const sheets = await loadSpreadsheet(
          { url, name, mediaType },
          controller.signal
        );
        if (!controller.signal.aborted) {
          setState({ status: "ready", sheets });
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setState({
            status: "error",
            message:
              error instanceof Error
                ? error.message
                : "Could not open this spreadsheet.",
          });
        }
      }
    };
    void load();
    return () => {
      controller.abort();
    };
  }, [url, name, mediaType]);
  return <SpreadsheetPreview state={state} />;
};
export const SpreadsheetViewerAction = ({
  artifact,
  onOpen,
}: {
  readonly artifact: ArtifactReference;
  readonly onOpen?: () => void;
}) => {
  const [open, setOpen] = useState(false);
  if (!spreadsheetFormat(artifact)) {
    return null;
  }
  return (
    <>
      <Button
        aria-label="Open spreadsheet"
        title="Open spreadsheet"
        size="icon-sm"
        variant="ghost"
        onClick={() => {
          onOpen?.();
          setOpen(true);
        }}
      >
        <Table2Icon size={16} />
      </Button>
      {open && (
        <Dialog open onOpenChange={setOpen}>
          <DialogContent className="w-[calc(100%-2rem)] max-w-5xl sm:max-w-5xl">
            <DialogTitle className="truncate pe-8">{artifact.name}</DialogTitle>
            <DialogDescription>Spreadsheet preview</DialogDescription>
            <LoadedSpreadsheet key={artifact.url} artifact={artifact} />
            <div className="flex justify-end">
              <ArtifactDownloadAction
                artifact={artifact}
                filename={artifact.name}
                label="Download spreadsheet"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};
