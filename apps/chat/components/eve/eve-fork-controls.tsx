"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { eveMessageTitle } from "@/lib/eve/message-input";
import { EveComposer } from "./eve-composer";
import type { useEveFork } from "./use-eve-fork";

export function EveForkControls({
  fork,
  conversationId,
  disabled,
}: {
  fork: ReturnType<typeof useEveFork>;
  conversationId: string;
  disabled: boolean;
}) {
  const branches = fork.family.data?.branches ?? [];
  return (
    <>
      {branches.length > 1 && (
        <nav
          aria-label="Conversation versions"
          className="flex items-center gap-2 border-b px-4 py-2"
        >
          <Select
            disabled={fork.busy}
            onValueChange={(id) => window.location.assign(`/chat/${id}`)}
            value={conversationId}
          >
            <SelectTrigger aria-label="Conversation version" className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {branches.map((branch, index) => (
                <SelectItem key={branch.id} value={branch.id}>
                  {index === 0 ? "Original" : `Version ${index + 1}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fork.family.data?.rootId !== conversationId && (
            <Link
              className="text-muted-foreground text-sm"
              href={`/chat/${fork.family.data?.rootId}`}
            >
              Original conversation
            </Link>
          )}
        </nav>
      )}
      {fork.family.isError && (
        <p className="p-4 text-sm" role="alert">
          Versions could not be loaded.{" "}
          <Button onClick={() => fork.family.refetch()} variant="ghost">
            Retry
          </Button>
        </p>
      )}
      {(fork.error || fork.pending) && (
        <section
          aria-label="Version recovery"
          className="space-y-2 border-b p-4 text-sm"
        >
          {fork.error && <p role="alert">{fork.error}</p>}
          {fork.pending && (
            <>
              <p role="status">
                {fork.busy
                  ? "Creating responses…"
                  : "Response creation is unconfirmed. Retry the saved request to recover it."}
              </p>
              <p className="whitespace-pre-wrap">
                {eveMessageTitle(fork.pending.message)}
              </p>
              <Button disabled={fork.busy} onClick={fork.retry} size="sm">
                {fork.pending && "modelIds" in fork.pending
                  ? "Recover comparison"
                  : "Recover version"}
              </Button>
            </>
          )}
        </section>
      )}
      <Dialog
        onOpenChange={(open) => {
          if (!fork.busy) {
            fork.setOpen(open);
          }
        }}
        open={fork.open}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit message</DialogTitle>
            <DialogDescription>
              Sending creates a new version. Your original conversation stays
              available.
            </DialogDescription>
          </DialogHeader>
          <EveComposer
            autoFocus
            busy={fork.busy}
            disabled={disabled || fork.locked}
            draft={fork.draft}
            files={fork.files}
            onDraftChange={fork.setDraft}
            onSubmit={fork.submit}
            onToolChange={fork.setSelectedTool}
            retainedModelId={
              fork.pending && !("modelIds" in fork.pending)
                ? fork.pending.modelId
                : undefined
            }
            selectedTool={
              fork.pending
                ? (fork.pending.selectedTool ?? null)
                : fork.selectedTool
            }
          />
          {fork.error && <p role="alert">{fork.error}</p>}
          <Button
            disabled={fork.busy}
            onClick={() => fork.setOpen(false)}
            variant="ghost"
          >
            Cancel edit
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
