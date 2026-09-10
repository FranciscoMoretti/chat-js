"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { useCallback, useState } from "react";
import {
  Artifact,
  ArtifactClose,
  ArtifactContent,
  ArtifactHeader,
  ArtifactTitle,
} from "@/components/ai-elements/artifact";
import {
  ChatLayout,
  ChatLayoutHandle,
  ChatLayoutMain,
  ChatLayoutSecondary,
} from "@/components/chat/chat-layout";
import { DocumentSkeleton } from "@/components/document-skeleton";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArtifactProvider, useArtifact } from "@/hooks/use-artifact";
import { getLanguageFromFileName } from "@/lib/utils";
import { useTRPC } from "@/trpc/react";
import { useDocumentDraft } from "./use-document-draft";

const Editor = dynamic(
  () => import("@/components/text-editor").then((m) => m.Editor),
  { ssr: false }
);
const CodeEditor = dynamic(
  () => import("@/components/code-editor").then((m) => m.CodeEditor),
  { ssr: false }
);
const SpreadsheetEditor = dynamic(
  () => import("@/components/sheet-editor").then((m) => m.SpreadsheetEditor),
  { ssr: false }
);

function DocumentSaveStatus({
  editing,
  editable,
}: {
  editing: ReturnType<typeof useDocumentDraft>;
  editable: boolean;
}) {
  let status = "Previous version · read only";
  if (editable) {
    status = "All changes saved";
  }
  if (editing.draft) {
    status = "Unsaved changes";
  }
  if (editing.saving) {
    status = "Saving…";
  }
  return (
    <div className="shrink-0 space-y-2 border-b px-4 py-2 text-sm">
      <p role="status">{status}</p>
      {editing.storageError && (
        <p role="alert">
          Draft recovery is unavailable in this browser. Keep this panel open
          until saved.
        </p>
      )}
      {editing.error && (
        <div className="space-y-2" role="alert">
          <p>{editing.error} Your draft has been kept.</p>
          <div className="flex gap-2">
            <Button onClick={editing.retry} size="sm" variant="outline">
              Retry save
            </Button>
            <Button onClick={editing.discard} size="sm" variant="outline">
              Discard draft
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function EveArtifactPanel({
  conversationId,
  readOnly,
}: {
  conversationId: string;
  readOnly: boolean;
}) {
  const { artifact, closeArtifact } = useArtifact();
  const [selectedRevisionId, setSelectedRevisionId] = useState(
    artifact.revisionId
  );
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const document = useQuery(
    trpc.eve.document.queryOptions({
      conversationId,
      documentId: artifact.documentId,
      revisionId: selectedRevisionId,
    })
  );
  const history = document.data?.history ?? [];
  const revision = document.data?.revision;
  const index = history.findIndex((item) => item.id === revision?.id);
  const onSaved = useCallback(
    async (revisionId: string) => {
      await queryClient.fetchQuery(
        trpc.eve.document.queryOptions({
          conversationId,
          documentId: artifact.documentId,
          revisionId,
        })
      );
      setSelectedRevisionId(revisionId);
      await queryClient.invalidateQueries({
        queryKey: trpc.eve.document.pathKey(),
      });
    },
    [queryClient, trpc, conversationId, artifact.documentId]
  );
  const editing = useDocumentDraft({
    conversationId,
    documentId: artifact.documentId,
    enabled: Boolean(!readOnly && document.data?.canEdit && !document.isError),
    revision,
    onSaved,
    onRestore: setSelectedRevisionId,
  });
  const editable =
    !readOnly &&
    document.data?.canEdit &&
    editing.ready &&
    (Boolean(editing.draft) || index === history.length - 1);
  const contentProps = {
    content: editing.draft?.content ?? revision?.content ?? "",
    currentVersionIndex: index,
    isCurrentVersion: index === history.length - 1,
    isReadonly: !editable,
    status: "idle" as const,
    onSaveContent: editing.edit,
  };
  return (
    <Artifact
      aria-label="Document"
      className="h-full min-h-0 w-full rounded-none border-0"
      data-testid="artifact"
      role="region"
    >
      <ArtifactHeader className="shrink-0 items-start bg-background/80 p-2">
        <div className="flex min-w-0 items-start gap-4">
          <ArtifactClose onClick={closeArtifact} variant="outline" />
          <ArtifactTitle className="break-words">
            {revision?.title ?? artifact.title}
          </ArtifactTitle>
        </div>
      </ArtifactHeader>
      {!readOnly && document.data?.canEdit && (
        <DocumentSaveStatus editable={Boolean(editable)} editing={editing} />
      )}
      <ArtifactContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
        {document.isPending && (
          <DocumentSkeleton artifactKind={artifact.kind} />
        )}
        {document.isError && (
          <div className="space-y-2 p-4" role="alert">
            <p>
              This document could not be loaded. It may no longer be shared.
            </p>
            <Button onClick={() => document.refetch()} variant="outline">
              Retry
            </Button>
          </div>
        )}
        {revision?.kind === "sheet" && !document.isError && (
          <div className="min-h-0 flex-1 overflow-hidden">
            <SpreadsheetEditor {...contentProps} saveContent={editing.edit} />
          </div>
        )}
        {revision && revision.kind !== "sheet" && !document.isError && (
          <ScrollArea className="min-h-0 flex-1">
            {revision.kind === "text" && (
              <div className="mx-auto max-w-3xl px-4 py-8">
                <Editor {...contentProps} />
              </div>
            )}
            {revision.kind === "code" && (
              <CodeEditor
                {...contentProps}
                language={getLanguageFromFileName(revision.title) || "python"}
              />
            )}
          </ScrollArea>
        )}
      </ArtifactContent>
      {revision && !document.isError && (
        <div className="flex shrink-0 items-center justify-between gap-2 border-t p-2">
          <Button
            disabled={Boolean(editing.draft) || index <= 0}
            onClick={() => setSelectedRevisionId(history[index - 1]?.id)}
            variant="outline"
          >
            Previous
          </Button>
          <span className="text-muted-foreground text-sm">
            Version {index + 1} of {history.length}
          </span>
          <Button
            disabled={Boolean(editing.draft) || index >= history.length - 1}
            onClick={() => setSelectedRevisionId(history[index + 1]?.id)}
            variant="outline"
          >
            Next
          </Button>
        </div>
      )}
    </Artifact>
  );
}

function Layout({
  children,
  conversationId,
  readOnly = false,
}: {
  children: ReactNode;
  conversationId?: string;
  readOnly?: boolean;
}) {
  const { artifact } = useArtifact();
  const visible = Boolean(
    conversationId && artifact.isVisible && artifact.documentId !== "init"
  );
  return (
    <ChatLayout isSecondaryPanelVisible={visible}>
      <ChatLayoutMain defaultSize={visible ? 65 : 100}>
        {children}
      </ChatLayoutMain>
      <ChatLayoutHandle />
      <ChatLayoutSecondary>
        {visible && conversationId && (
          <EveArtifactPanel
            conversationId={conversationId}
            key={`${artifact.documentId}:${artifact.revisionId ?? "latest"}`}
            readOnly={readOnly}
          />
        )}
      </ChatLayoutSecondary>
    </ChatLayout>
  );
}

export function EveArtifactLayout(props: {
  children: ReactNode;
  conversationId?: string;
  readOnly?: boolean;
}) {
  return (
    <ArtifactProvider key={props.conversationId ?? "new"}>
      <Layout {...props} />
    </ArtifactProvider>
  );
}
