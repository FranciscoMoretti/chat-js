"use client";

import { documentDefinitions } from "@/integrations/documents/definitions";
import { documents } from "@/integrations/documents/ui";

import { hasText } from "@/components/text-value";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import React, { useCallback, useEffect, useState } from "react";
import type { JSX as ReactJSX } from "react";

import { XIcon } from "lucide-react";
import {
  ChatLayout,
  ChatLayoutHandle,
  ChatLayoutMain,
  ChatLayoutSecondary,
} from "@/components/chat/chat-layout";
import { DocumentSkeleton } from "@/components/document-skeleton";
import { Button } from "@/components/ui/button";
import { ArtifactProvider, useArtifact } from "@/hooks/use-artifact";
import type { DocumentAssistantRequest } from "@/chatjs/core/documents/contracts";
import { eveDocumentResult } from "@/chatjs/core/documents/contracts";
import type {
  ReadonlyEveMessage,
  ReadonlyEveMessagePart,
} from "@/lib/eve/readonly-message-types";
import type { ReadonlyReactNode } from "@/lib/readonly-react-node";
import { DocumentRun } from "@/integrations/documents/run";
import { useTRPC } from "@/trpc/react";

import { EveDocumentActions } from "./eve-document-actions";
import { EveDocumentAssistantActions } from "./eve-document-assistant-actions";
import { DocumentBody } from "./eve-document-body";
import {
  EveDocumentContext,
  EveDocumentReplayContext,
} from "./eve-document-context";
import { useDocumentDraft } from "./use-document-draft";

const artifactRegionProps = { role: "region" as const };
const emptyEveMessages: readonly ReadonlyEveMessage[] = [];

interface DocumentActionProps {
  readonly messages?: readonly ReadonlyEveMessage[];
  readonly replaying?: boolean;
  readonly onStopExecution?: (conversationId: string) => void | Promise<void>;
  readonly isExecutionBusy?: (conversationId: string) => boolean;
  readonly getExecutionMessages?: (
    conversationId: string
  ) => readonly ReadonlyEveMessage[];
  readonly onDocumentAction?: (
    request: DocumentAssistantRequest
  ) => void | Promise<void>;
  readonly documentActionsDisabled?: boolean;
}

const DocumentSaveStatus = ({
  editing,
}: {
  readonly editing: {
    readonly retry: () => Promise<void>;
    readonly discard: () => void;
    readonly storageError: boolean;
    readonly error: string | undefined;
  };
}): React.JSX.Element => {
  const [, startEventAction] = React.useTransition();
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
      {hasText(editing.error) && (
        <div className="space-y-2" role="alert">
          <p>{editing.error} Your draft has been kept.</p>
          <div className="flex gap-2">
            <Button
              onClick={() => {
                const completion = handleRetry();
                startEventAction(async () => {
                  await completion;
                });
              }}
              size="sm"
              variant="outline"
            >
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

const documentContentState = ({
  previewing,
  artifactContent,
  editing,
  revisionContent,
  index,
  historyLength,
  owned,
  documentError,
  documentActionsDisabled,
}: {
  readonly previewing: boolean;
  readonly artifactContent: string;
  readonly editing: ReturnType<typeof useDocumentDraft>;
  readonly revisionContent: string | undefined;
  readonly index: number;
  readonly historyLength: number;
  readonly owned: boolean | undefined;
  readonly documentError: boolean;
  readonly documentActionsDisabled: boolean;
}) => {
  const editable =
    owned === true &&
    !previewing &&
    editing.ready &&
    (Boolean(editing.draft) || index === historyLength - 1);
  return {
    contentProps: {
      content: previewing
        ? artifactContent
        : (editing.draft?.content ?? revisionContent ?? ""),
      currentVersionIndex: index,
      isCurrentVersion: index === historyLength - 1,
      isReadonly: !editable,
      onSaveContent: editing.edit,
      status: previewing ? ("streaming" as const) : ("idle" as const),
    },
    actionsDisabled:
      documentError ||
      documentActionsDisabled ||
      !editable ||
      Boolean(editing.draft),
  };
};

const documentSubtitle = (
  previewing: boolean,
  editing: ReturnType<typeof useDocumentDraft>,
  createdAt: Date | undefined
): string => {
  if (previewing) {
    return "Writing document…";
  }
  if (editing.draft || editing.saving) {
    return "Saving changes...";
  }
  if (createdAt) {
    return `Updated ${formatDistanceToNow(new Date(createdAt), { addSuffix: true })}`;
  }
  return "Loading document…";
};

const isInstalledDocument = (kind: string | undefined): boolean =>
  kind !== undefined &&
  documentDefinitions.kinds.has(kind) &&
  documents[kind]?.Body !== undefined;

const useDocumentPanel = ({
  conversationId,
  readOnly,
  onDocumentAction,
  documentActionsDisabled = false,
  messages = emptyEveMessages,
  executionBusy,
  onStop,
}: {
  readonly conversationId: string;
  readonly executionBusy?: boolean;
  readonly onStop?: () => Promise<void>;
  readonly readOnly: boolean;
} & DocumentActionProps) => {
  const { artifact, closeArtifact, setArtifact } = useArtifact();
  const selectedRevisionId =
    artifact.followLive === true ? undefined : artifact.revisionId;
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
  const index = history.findIndex(
    (item: { readonly id: string }) => item.id === revision?.id
  );
  const previewing =
    artifact.status === "streaming" && artifact.followLive !== false;
  const owned =
    !readOnly &&
    document.data?.canEdit === true &&
    isInstalledDocument(revision?.kind);
  const onSaved = useCallback(async () => {
    // Hydrate the destination query before switching the view: an empty latest query would unmount the focused editor.

    // Query refreshes the destination document before changing revision selection so the focused editor stays mounted.
    await queryClient.query(
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
    enabled: owned && !document.isError,
    onRestore: setSelectedRevisionId,
    onSaved,
    revision,
  });
  const { contentProps, actionsDisabled } = documentContentState({
    previewing,
    artifactContent: artifact.content,
    editing,
    revisionContent: revision?.content,
    index,
    historyLength: history.length,
    owned,
    documentError: document.isError,
    documentActionsDisabled,
  });
  const selectRevision = (id?: string): void => {
    setSelectedRevisionId(id);
    setArtifact((current) => ({ ...current, followLive: id === undefined }));
  };
  const restoreVersion = (): void => {
    const latest = history.at(-1);
    if (!revision || !latest) {
      return;
    }
    editing.restore(revision.content, revision.title, latest.id);
  };
  const previousRevisionId = history[index - 1]?.id;
  const canCompare = Boolean(previousRevisionId && !editing.draft);
  const comparing = showChanges && canCompare;
  const subtitle = documentSubtitle(previewing, editing, revision?.createdAt);
  return {
    conversationId,
    readOnly,
    onDocumentAction,
    messages,
    executionBusy,
    onStop,
    artifact,
    closeArtifact,
    history,
    revision,
    index,
    previewing,
    owned,
    document,
    editing,
    contentProps,
    selectRevision,
    restoreVersion,
    previousRevisionId,
    canCompare,
    comparing,
    actionsDisabled,
    subtitle,
    setShowChanges,
  };
};

interface PanelModelProps {
  readonly model: ReturnType<typeof useDocumentPanel>;
}

const DocumentPanelHeader = ({ model }: PanelModelProps): ReactJSX.Element => {
  const {
    closeArtifact,
    previewing,
    artifact,
    revision,
    subtitle,
    document,
    canCompare,
    comparing,
    contentProps,
    setShowChanges,
    editing,
    index,
    history,
    selectRevision,
    messages,
    actionsDisabled,
    owned,
    onDocumentAction,
  } = model;
  return (
    <div className="bg-background/80 flex shrink-0 items-start justify-between border-b p-2">
      <div className="flex min-w-0 items-start gap-4">
        <Button
          className="text-muted-foreground hover:text-foreground hover:bg-accent h-fit w-8 p-2"
          onClick={closeArtifact}
          size="sm"
          type="button"
          variant="outline"
        >
          <XIcon className="size-4" />
          <span className="sr-only">Close</span>
        </Button>
        <div className="min-w-0">
          <p className="text-foreground text-sm font-medium break-words">
            {previewing ? artifact.title : (revision?.title ?? artifact.title)}
          </p>
          <p className="text-muted-foreground text-sm">{subtitle} </p>
        </div>
      </div>
      {revision && !document.isError && (
        <EveDocumentActions
          canCompare={canCompare}
          comparing={comparing}
          content={contentProps.content}
          kind={revision.kind}
          onCompare={() => {
            setShowChanges((current) => !current);
          }}
          disabled={previewing}
          previousDisabled={Boolean(editing.draft) || index <= 0}
          nextDisabled={Boolean(editing.draft) || index >= history.length - 1}
          onPrevious={() => {
            selectRevision(history[index - 1]?.id);
          }}
          onNext={() => {
            selectRevision(
              index + 1 === history.length - 1
                ? undefined
                : history[index + 1]?.id
            );
          }}
          run={
            DocumentRun && (
              <DocumentRun
                documentId={artifact.documentId}
                revisionId={revision.id}
                title={revision.title}
                kind={revision.kind}
                messages={messages}
                disabled={actionsDisabled}
                onAction={owned ? onDocumentAction : undefined}
                buttonOnly
              />
            )
          }
        />
      )}
    </div>
  );
};

const DocumentAssistantControls = ({
  model,
}: PanelModelProps): ReactJSX.Element => {
  const {
    previewing,
    revision,
    readOnly,
    executionBusy,
    onStop,
    artifact,
    owned,
    index,
    history,
    onDocumentAction,
    actionsDisabled,
    selectRevision,
  } = model;
  return (
    <>
      {previewing &&
        !revision &&
        !readOnly &&
        executionBusy === true &&
        onStop && (
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
        (onDocumentAction !== undefined || onStop !== undefined) &&
        revision && (
          <EveDocumentAssistantActions
            disabled={actionsDisabled}
            busy={executionBusy}
            onStop={onStop}
            documentId={artifact.documentId}
            kind={revision.kind}
            onAction={
              onDocumentAction
                ? async (request: DocumentAssistantRequest) => {
                    selectRevision();
                    await onDocumentAction(request);
                  }
                : undefined
            }
            revisionId={revision.id}
          />
        )}
    </>
  );
};

const DocumentPanelContent = ({ model }: PanelModelProps): ReactJSX.Element => {
  const {
    document,
    previewing,
    artifact,
    contentProps,
    revision,
    comparing,
    previousRevisionId,
    conversationId,
    index,
  } = model;
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
      {document.isPending && !previewing && (
        <DocumentSkeleton artifactKind={artifact.kind} />
      )}
      {document.isError && (
        <div className="space-y-2 p-4" role="alert">
          <p>This document could not be loaded. It may no longer be shared.</p>
          <Button
            onClick={() => {
              void document.refetch();
            }}
            variant="outline"
          >
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
      <DocumentAssistantControls model={model} />
    </div>
  );
};

const DocumentPanelFooter = ({
  model,
}: PanelModelProps): ReactJSX.Element | null => {
  const {
    revision,
    document,
    actionsDisabled,
    artifact,
    messages,
    owned,
    onDocumentAction,
    index,
    history,
    editing,
    restoreVersion,
    selectRevision,
  } = model;
  if (!revision || document.isError) {
    return null;
  }
  return (
    <>
      {DocumentRun && (
        <DocumentRun
          disabled={actionsDisabled}
          documentId={artifact.documentId}
          kind={revision.kind}
          messages={messages}
          onAction={owned ? onDocumentAction : undefined}
          revisionId={revision.id}
          title={revision.title}
          resultOnly
        />
      )}
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
              onClick={() => {
                selectRevision();
              }}
            >
              Back to latest version
            </Button>
          </div>
        </div>
      )}
    </>
  );
};

const EveArtifactPanel = (
  props: Parameters<typeof useDocumentPanel>[0]
): ReactJSX.Element => {
  const model = useDocumentPanel(props);
  const { owned, editing, index, history } = model;
  return (
    <div
      aria-label="Document"
      className="bg-background relative flex h-full min-h-0 w-full flex-col overflow-hidden rounded-none border-0 shadow-sm"
      data-testid="artifact"
      {...artifactRegionProps}
    >
      <DocumentPanelHeader model={model} />
      {owned && <DocumentSaveStatus editing={editing} />}
      <span className="sr-only">
        Version {index + 1} of {history.length}
      </span>
      {owned && !editing.draft && !editing.saving && (
        <span className="sr-only">All changes saved</span>
      )}
      <DocumentPanelContent model={model} />
      <DocumentPanelFooter model={model} />
    </div>
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
  readonly children: ReadonlyReactNode;
  readonly conversationId?: string;
  readonly readOnly?: boolean;
} & DocumentActionProps) => {
  const { artifact, setArtifact } = useArtifact();
  const ownerId = artifact.conversationId ?? conversationId;
  const busy = hasText(ownerId) ? isExecutionBusy?.(ownerId) : undefined;
  const ownerMessages = hasText(ownerId)
    ? getExecutionMessages?.(ownerId)
    : undefined;
  useEffect(() => {
    if (artifact.status !== "streaming" || !hasText(artifact.previewCallId)) {
      return;
    }
    const call = ownerMessages
      ?.flatMap(
        (message: Readonly<{ parts: readonly ReadonlyEveMessagePart[] }>) =>
          message.parts
      )
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
  const visible = hasText(conversationId) && artifact.isVisible;
  return (
    <ChatLayout isSecondaryPanelVisible={visible}>
      <ChatLayoutMain defaultSize={visible ? "65%" : "100%"}>
        {children}
      </ChatLayoutMain>
      <ChatLayoutHandle />
      <ChatLayoutSecondary>
        {visible && hasText(conversationId) && (
          <EveArtifactPanel
            conversationId={artifact.conversationId ?? conversationId}
            documentActionsDisabled={documentActionsDisabled}
            executionBusy={busy}
            onStop={
              hasText(ownerId) && onStopExecution
                ? async () => {
                    await onStopExecution(ownerId);
                  }
                : undefined
            }
            key={`${artifact.conversationId ?? conversationId}:${artifact.documentId}`}
            messages={ownerMessages ?? messages}
            onDocumentAction={
              !hasText(artifact.conversationId) ||
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
    readonly children: ReadonlyReactNode;
    readonly conversationId?: string;
    readonly logicalChatId?: string;
    readonly readOnly?: boolean;
  } & DocumentActionProps
): React.JSX.Element => (
  <ArtifactProvider key={props.logicalChatId ?? props.conversationId ?? "new"}>
    <EveDocumentContext.Provider value={props.conversationId}>
      <EveDocumentReplayContext.Provider value={props.replaying ?? false}>
        <Layout {...props} />
      </EveDocumentReplayContext.Provider>
    </EveDocumentContext.Provider>
  </ArtifactProvider>
);
