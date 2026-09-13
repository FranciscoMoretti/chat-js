"use client";

import { useState } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type EveDeletionPhase =
  | "confirm"
  | "deleting"
  | "pending"
  | "unconfirmed"
  | "checking"
  | "unavailable"
  | "not_started";
const resultSchema = z.object({
  rootId: z.uuid(),
  status: z.enum(["active", "pending", "deleted"]),
});

export function EveDeleteDialog({
  conversation,
  onClose,
  onChanged,
}: {
  conversation: { id: string; title: string; state: string };
  onClose: () => void;
  onChanged: (rootId: string) => Promise<void>;
}) {
  const [phase, setPhase] = useState<EveDeletionPhase>(
    conversation.state === "deleting" ? "pending" : "confirm"
  );
  async function request(method: "GET" | "DELETE") {
    setPhase(method === "GET" ? "checking" : "deleting");
    try {
      const response = await fetch(
        `/api/agent-conversations/${conversation.id}`,
        { method, signal: AbortSignal.timeout(60_000) }
      );
      if (response.status === 503) {
        setPhase("unavailable");
        return;
      }
      if (response.status === 409) {
        setPhase("not_started");
        return;
      }
      if (!response.ok) {
        throw new Error("Deletion unconfirmed");
      }
      const result = resultSchema.parse(await response.json());
      if (result.status === "active") {
        setPhase("confirm");
        return;
      }
      if (result.status === "deleted") {
        await onChanged(result.rootId).catch(() => undefined);
        onClose();
        return;
      }
      setPhase("pending");
      await onChanged(result.rootId).catch(() => undefined);
    } catch {
      setPhase("unconfirmed");
    }
  }
  return (
    <EveDeleteDialogView
      onCheck={() => request("GET")}
      onClose={onClose}
      onDelete={() => request("DELETE")}
      phase={phase}
      title={conversation.title}
    />
  );
}

export function EveDeleteDialogView({
  title,
  phase,
  onClose,
  onDelete,
  onCheck,
}: {
  title: string;
  phase: EveDeletionPhase;
  onClose: () => void;
  onDelete: () => void;
  onCheck: () => void;
}) {
  const busy = phase === "deleting" || phase === "checking";
  return (
    <Dialog
      onOpenChange={(open) => {
        if (!(open || busy)) {
          onClose();
        }
      }}
      open
    >
      <DialogContent showCloseButton={!busy}>
        <DialogHeader>
          <DialogTitle className="mr-6">
            Delete conversation and branches?
          </DialogTitle>
          <DialogDescription>
            “{title}” belongs to a conversation family. Deleting it permanently
            removes the original conversation, all its branches, and their
            files. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        {phase === "not_started" && (
          <p role="alert">
            Deletion has not started. Finish recovering any pending conversation
            creation, then retry.
          </p>
        )}
        {phase === "deleting" && (
          <p role="status">Deleting conversation and branches…</p>
        )}
        {phase === "checking" && <p role="status">Checking deletion status…</p>}
        {phase === "pending" && (
          <p role="status">
            Access has been removed, but cleanup is not complete. Retry to
            continue. You can also resume deletion from the sidebar later.
          </p>
        )}
        {phase === "unconfirmed" && (
          <p role="alert">
            The deletion result could not be confirmed. Check its status before
            continuing.
          </p>
        )}
        {phase === "unavailable" && (
          <p role="alert">
            Deletion is not available for this server configuration. Cleanup
            could not be completed.
          </p>
        )}
        <DialogFooter>
          <Button disabled={busy} onClick={onClose} variant="outline">
            {phase === "confirm" ? "Cancel" : "Close"}
          </Button>
          {(phase === "pending" || phase === "unconfirmed") && (
            <Button onClick={onCheck} variant="outline">
              Check status
            </Button>
          )}
          {(phase === "confirm" ||
            phase === "not_started" ||
            phase === "pending" ||
            phase === "deleting") && (
            <Button disabled={busy} onClick={onDelete} variant="destructive">
              {phase === "pending"
                ? "Retry deletion"
                : "Delete conversation and branches"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
