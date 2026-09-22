"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import type { EveMessage } from "eve/client";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";

import {
  Artifact,
  ArtifactClose,
  ArtifactDescription,
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
import { ArtifactProvider, useArtifact } from "@/hooks/use-artifact";
import type { DocumentAssistantRequest } from "@/lib/eve/document-assistant-actions";
import { eveDocumentResult } from "@/lib/eve/document-contracts";
import { useTRPC } from "@/trpc/react";

import { EveDocumentActions } from "./eve-document-actions";
import { EveDocumentAssistantActions } from "./eve-document-assistant-actions";
import { DocumentBody } from "./eve-document-body";
import {
  EveDocumentContext,
  EveDocumentReplayContext,
} from "./eve-document-context";
import { EveDocumentRun } from "./eve-document-run";
import { useDocumentDraft } from "./use-document-draft";

const artifactRegionProps = { role: "region" as const };
const emptyEveMessages: readonly EveMessage[] = [];

type DocumentActionProps = {
  messages?: readonly EveMessage[];
  replaying?: boolean;
  onStopExecution?: (conversationId: string) => Promise<void>;
  isExecutionBusy?: (conversationId: string) => boolean;
  getExecutionMessages?: (conversationId: string) => readonly EveMessage[];
  onDocumentAction?: (request: DocumentAssistantRequest) => Promise<void>;
  documentActionsDisabled?: boolean;
};

const DocumentSaveStatus = ({
  editing,
}: {
  editing: ReturnType<typeof useDocumentDraft>;
}) => {
  const handleRetry = editing.retry;
  const handleDiscard = editing.discard;
  return (
    <div className="shrink-0 space-y-2 px-4 text-sm">
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
            <Button onClick={handleRetry} size="sm" variant="outline">
              Retry save
            </Button>
            <Button onClick={handleDiscard} size="sm" variant="outline">
              Discard draft
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

// This panel coordinates editor, revision, assistant, and recovery states.
// oxlint-disable-next-line eslint/complexity
const EveArtifactPanel = ({
  conversationId,
  readOnly,
  onDocumentAction,
  documentActionsDisabled = false,
  messages = emptyEveMessages,
  executionBusy,
  onStop,
}: {
  conversationId: string;
  executionBusy?: boolean;
  onStop?: () => Promise<void>;
  readOnly: boolean;
} & DocumentActionProps) => {
  const { artifact, closeArtifact, setArtifact } = useArtifact();
  const selectedRevisionId = artifact.followLive
    ? undefined
    : artifact.revisionId;
  const setSelectedRevisionId = useCallback(
    (revisionId: string | undefined) => {
      setArtifact((current) => ({
        ...current,
        followLive: revisionId === undefined,
        revisionId,
      }));
    },
    [setArtifact]
  );
  const [showChanges, setShowChanges] = useState(false);
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const document = useQuery(
    trpc.eve.document.queryOptions(
      {
        conversationId,
        documentId: artifact.documentId,
        revisionId: selectedRevisionId,
      },
      { enabled: artifact.documentId !== "init" }
    )
  );
  const history = document.data?.history ?? [];
  const revision = document.data?.revision;
  const index = history.findIndex((item) => item.id === revision?.id);
  const previewing =
    artifact.status === "streaming" && artifact.followLive !== false;
  const owned = !readOnly && document.data?.canEdit;
  const onSaved = useCallback(async () => {
    // Hydrate the destination query before switching the view: an empty latest query would unmount the focused editor.
    await queryClient.fetchQuery(
      trpc.eve.document.queryOptions(
        {
          conversationId,
          documentId: artifact.documentId,
        },
        { staleTime: 0 }
      )
    );
    setSelectedRevisionId(undefined);
    await queryClient.invalidateQueries({
      queryKey: trpc.eve.document.pathKey(),
    });
  }, [
    queryClient,
    trpc,
    conversationId,
    artifact.documentId,
    setSelectedRevisionId,
  ]);
  const editing = useDocumentDraft({
    conversationId,
    documentId: artifact.documentId,
    enabled: Boolean(owned && !document.isError),
    onRestore: setSelectedRevisionId,
    onSaved,
    revision,
  });
  const editable =
    owned &&
    !previewing &&
    editing.ready &&
    (Boolean(editing.draft) || index === history.length - 1);
  const contentProps = {
    content: previewing
      ? artifact.content
      : (editing.draft?.content ?? revision?.content ?? ""),
    currentVersionIndex: index,
    isCurrentVersion: index === history.length - 1,
    isReadonly: !editable,
    onSaveContent: editing.edit,
    status: previewing ? ("streaming" as const) : ("idle" as const),
  };
  const selectRevision = (id: string | undefined) => {
    setSelectedRevisionId(id);
    setArtifact((current) => ({ ...current, followLive: id === undefined }));
  };
  const restoreVersion = () => {
    const latest = history.at(-1);
    if (!revision || !latest) {
      return;
    }
    editing.restore(revision.content, revision.title, latest.id);
  };
  const previousRevisionId = history[index - 1]?.id;
  const canCompare = Boolean(previousRevisionId && !editing.draft);
  const comparing = showChanges && canCompare;
  const actionsDisabled =
    document.isError ||
    documentActionsDisabled ||
    !editable ||
    Boolean(editing.draft);
  let subtitle = "Loading document…";
  if (revision?.createdAt) {
    subtitle = `Updated ${formatDistanceToNow(new Date(revision.createdAt), { addSuffix: true })}`;
  }
  if (editing.draft || editing.saving) {
    subtitle = "Saving changes...";
  }
  if (previewing) {
    subtitle = "Writing document…";
  }
  return (
    <>
      {/* oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- Artifact is a shared div primitive; this identifies the document region. */}
      <Artifact
        aria-label="Document"
        className="relative h-full min-h-0 w-full rounded-none border-0"
        data-testid="artifact"
        {...artifactRegionProps}
      >
        <ArtifactHeader className="bg-background/80 shrink-0 items-start p-2">
          <div className="flex min-w-0 items-start gap-4">
            <ArtifactClose
              className="hover:bg-accent h-fit p-2"
              onClick={closeArtifact}
              variant="outline"
            />
            <div className="min-w-0">
              <ArtifactTitle className="break-words">
                {previewing
                  ? artifact.title
                  : (revision?.title ?? artifact.title)}
              </ArtifactTitle>
              <ArtifactDescription>{subtitle} </ArtifactDescription>
            </div>
          </div>
          {revision && !document.isError && (
            <EveDocumentActions
              canCompare={canCompare}
              comparing={comparing}
              content={contentProps.content}
              kind={revision.kind}
              onCompare={() => setShowChanges((current) => !current)}
              disabled={previewing}
              previousDisabled={Boolean(editing.draft) || index <= 0}
              nextDisabled={
                Boolean(editing.draft) || index >= history.length - 1
              }
              onPrevious={() => selectRevision(history[index - 1]?.id)}
              onNext={() =>
                selectRevision(
                  index + 1 === history.length - 1
                    ? undefined
                    : history[index + 1]?.id
                )
              }
              run={
                <EveDocumentRun
                  documentId={artifact.documentId}
                  revisionId={revision.id}
                  title={revision.title}
                  kind={revision.kind}
                  messages={messages}
                  disabled={actionsDisabled}
                  onAction={owned ? onDocumentAction : undefined}
                  buttonOnly
                />
              }
            />
          )}
        </ArtifactHeader>
        {owned && <DocumentSaveStatus editing={editing} />}
        <span className="sr-only">
          Version {index + 1} of {history.length}
        </span>
        {owned && !editing.draft && !editing.saving && (
          <span className="sr-only">All changes saved</span>
        )}
        <ArtifactContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
          {document.isPending && !previewing && (
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
          {previewing && (
            <DocumentBody
              editorProps={contentProps}
              kind={artifact.kind}
              title={artifact.title}
            />
          )}
          {revision && !document.isError && !previewing && (
            <DocumentBody
              comparison={
                comparing && previousRevisionId
                  ? {
                      content: revision.content,
                      conversationId,
                      documentId: artifact.documentId,
                      previousRevisionId,
                      version: index + 1,
                    }
                  : undefined
              }
              editorProps={contentProps}
              kind={revision.kind}
              title={revision.title}
            />
          )}
          {previewing && !revision && !readOnly && executionBusy && onStop && (
            <EveDocumentAssistantActions
              kind={artifact.kind}
              documentId={artifact.documentId}
              revisionId=""
              disabled
              busy
              onStop={onStop}
            />
          )}
          {owned &&
            index === history.length - 1 &&
            (onDocumentAction || onStop) &&
            revision && (
              <EveDocumentAssistantActions
                disabled={actionsDisabled}
                busy={executionBusy}
                onStop={onStop}
                documentId={artifact.documentId}
                kind={revision.kind}
                onAction={
                  onDocumentAction
                    ? (request) => {
                        selectRevision(undefined);
                        return onDocumentAction(request);
                      }
                    : undefined
                }
                revisionId={revision.id}
              />
            )}
        </ArtifactContent>
        {revision && !document.isError && (
          <>
            <EveDocumentRun
              disabled={actionsDisabled}
              documentId={artifact.documentId}
              kind={revision.kind}
              messages={messages}
              onAction={owned ? onDocumentAction : undefined}
              revisionId={revision.id}
              title={revision.title}
              resultOnly
            />
            {owned && index !== -1 && index < history.length - 1 && (
              <div className="bg-background flex flex-col justify-between gap-4 border-t p-4 lg:flex-row">
                <div>
                  <div>You are viewing a previous version</div>
                  <div className="text-muted-foreground text-sm">
                    Restore this version to make edits
                  </div>
                </div>
                <div className="flex flex-wrap gap-4">
                  <Button
                    disabled={Boolean(editing.draft) || editing.saving}
                    onClick={restoreVersion}
                  >
                    Restore this version
                  </Button>
                  <Button
                    disabled={Boolean(editing.draft)}
                    variant="outline"
                    onClick={() => selectRevision(undefined)}
                  >
                    Back to latest version
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Artifact>
    </>
  );
};

const Layout = ({
  children,
  conversationId,
  readOnly = false,
  onDocumentAction,
  documentActionsDisabled,
  messages,
  isExecutionBusy,
  getExecutionMessages,
  onStopExecution,
}: {
  children: ReactNode;
  conversationId?: string;
  readOnly?: boolean;
} & DocumentActionProps) => {
  const { artifact, setArtifact } = useArtifact();
  const ownerId = artifact.conversationId ?? conversationId;
  const busy = ownerId ? isExecutionBusy?.(ownerId) : undefined;
  const ownerMessages = ownerId ? getExecutionMessages?.(ownerId) : undefined;
  useEffect(() => {
    if (artifact.status !== "streaming" || !artifact.previewCallId) {
      return;
    }
    const call = ownerMessages
      ?.flatMap((message) => message.parts)
      .find(
        (part) =>
          part.type === "dynamic-tool" &&
          part.toolCallId === artifact.previewCallId
      );
    if (call?.type === "dynamic-tool" && call.state === "output-available") {
      const result = eveDocumentResult.safeParse(call.output);
      if (result.success) {
        setArtifact((current) => ({
          ...current,
          content: "",
          date: result.data.date,
          documentId: result.data.documentId,
          kind: result.data.kind,
          previewCallId: undefined,
          revisionId: undefined,
          status: "idle",
          title: result.data.title,
        }));
        return;
      }
    }
    if (busy === false) {
      setArtifact((current) => ({
        ...current,
        isVisible: current.documentId !== "init" && current.isVisible,
        previewCallId: undefined,
        status: "idle",
      }));
    }
  }, [
    artifact.status,
    artifact.previewCallId,
    busy,
    ownerMessages,
    setArtifact,
  ]);
  const visible = Boolean(conversationId && artifact.isVisible);
  return (
    <ChatLayout isSecondaryPanelVisible={visible}>
      <ChatLayoutMain defaultSize={visible ? 65 : 100}>
        {children}
      </ChatLayoutMain>
      <ChatLayoutHandle />
      <ChatLayoutSecondary>
        {visible && conversationId && (
          <EveArtifactPanel
            conversationId={artifact.conversationId ?? conversationId}
            documentActionsDisabled={documentActionsDisabled}
            executionBusy={busy}
            onStop={
              ownerId && onStopExecution
                ? () => onStopExecution(ownerId)
                : undefined
            }
            key={`${artifact.conversationId ?? conversationId}:${artifact.documentId}`}
            messages={ownerMessages ?? messages}
            onDocumentAction={
              !artifact.conversationId ||
              artifact.conversationId === conversationId
                ? onDocumentAction
                : undefined
            }
            readOnly={readOnly}
          />
        )}
      </ChatLayoutSecondary>
    </ChatLayout>
  );
};

export const EveArtifactLayout = (
  props: {
    children: ReactNode;
    conversationId?: string;
    logicalChatId?: string;
    readOnly?: boolean;
  } & DocumentActionProps
) => (
  <ArtifactProvider key={props.logicalChatId ?? props.conversationId ?? "new"}>
    <EveDocumentContext.Provider value={props.conversationId}>
      <EveDocumentReplayContext.Provider value={props.replaying ?? false}>
        <Layout {...props} />
      </EveDocumentReplayContext.Provider>
    </EveDocumentContext.Provider>
  </ArtifactProvider>
);
