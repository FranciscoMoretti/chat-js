"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { EveMessage } from "eve/client";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import React, { useCallback, useEffect, useState } from "react";
/* oxlint-enable sort-imports */
import type { JSX as ReactJSX, ReactNode } from "react";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import {
  Artifact,
  ArtifactClose,
  ArtifactContent,
  ArtifactDescription,
  ArtifactHeader,
  ArtifactTitle,
} from "@/components/ai-elements/artifact";
/* oxlint-enable sort-imports */
import {
  ChatLayout,
  ChatLayoutHandle,
  ChatLayoutMain,
  ChatLayoutSecondary,
} from "@/components/chat/chat-layout";
import { DocumentSkeleton } from "@/components/document-skeleton";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { Button } from "@/components/ui/button";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { ArtifactProvider, useArtifact } from "@/hooks/use-artifact";
/* oxlint-enable sort-imports */
import type { DocumentAssistantRequest } from "@/lib/eve/document-contracts";
import { eveDocumentResult } from "@/lib/eve/document-contracts";
/* oxlint-disable import/max-dependencies -- @/tools/chatjs/document-run import: import/max-dependencies: these direct dependencies compose this feature without hiding imports behind a barrel. */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { DocumentRun } from "@/tools/chatjs/document-run";
/* oxlint-enable sort-imports */
/* oxlint-enable import/max-dependencies */
import { useTRPC } from "@/trpc/react";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { EveDocumentActions } from "./eve-document-actions";
/* oxlint-enable sort-imports */
import { EveDocumentAssistantActions } from "./eve-document-assistant-actions";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { DocumentBody } from "./eve-document-body";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  EveDocumentContext,
  EveDocumentReplayContext,
} from "./eve-document-context";
/* oxlint-enable sort-imports */
import { useDocumentDraft } from "./use-document-draft";

const artifactRegionProps = { role: "region" as const };
const emptyEveMessages: readonly EveMessage[] = [];
/* oxlint-disable typescript/prefer-readonly-parameter-types -- DocumentActionProps: typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including request: DocumentAssistantRequest). */

interface DocumentActionProps {
  messages?: readonly EveMessage[];
  replaying?: boolean;
  onStopExecution?: (conversationId: string) => Promise<void>;
  isExecutionBusy?: (conversationId: string) => boolean;
  getExecutionMessages?: (conversationId: string) => readonly EveMessage[];
  onDocumentAction?: (request: DocumentAssistantRequest) => Promise<void>;
  documentActionsDisabled?: boolean;
}
/* oxlint-disable react/jsx-no-literals -- DocumentSaveStatus renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-disable react/jsx-max-depth, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, typescript/strict-void-return -- DocumentSaveStatus: react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types; typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including editing.error); typescript/strict-void-return: this library event API ignores the return value while the existing handler owns its async pending and error lifecycle. */

const DocumentSaveStatus = ({
  editing,
}: {
  editing: ReturnType<typeof useDocumentDraft>;
}): React.JSX.Element => {
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
            <Button
              // oxlint-disable-next-line typescript/no-misused-promises -- #585: Draft retry and query refetch expose asynchronous lifecycle state through their owning hooks.
              onClick={handleRetry}
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
/* oxlint-enable react/jsx-no-literals */
/* oxlint-disable react/jsx-no-literals -- EveArtifactPanel renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */
/* oxlint-enable react/jsx-max-depth, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, typescript/strict-void-return */
/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, no-undefined, react-perf/jsx-no-jsx-as-prop, react-perf/jsx-no-new-function-as-prop, react-perf/jsx-no-new-object-as-prop, react/jsx-max-depth, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions -- EveArtifactPanel: max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 1); no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; react-perf/jsx-no-jsx-as-prop: this component composition slot accepts an element from the current render; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react-perf/jsx-no-new-object-as-prop: this prop object derives from current render state or feature styling; hoisting changes its ownership; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including current); typescript/promise-function-async: return the existing promise directly; adding async changes synchronous throw behavior and promise identity; typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including artifact.followLive). */

// This panel coordinates editor, revision, assistant, and recovery states.
// oxlint-disable-next-line eslint/complexity -- Review debt #620: split this state/render orchestration only after verifying its pending, recovery and failure transitions.
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
} & DocumentActionProps): ReactJSX.Element => {
  const { artifact, closeArtifact, setArtifact } = useArtifact();
  // oxlint-disable-next-line no-ternary -- Keep selectedRevisionId as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
  const selectedRevisionId = artifact.followLive
    ? undefined
    : artifact.revisionId;
  const setSelectedRevisionId = useCallback(
    (revisionId: string | undefined) => {
      setArtifact((current) => ({
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing current own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
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
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading history from document.data; preserve one receiver evaluation, skipped accesses and the existing [] fallback. The app guidance prefers optional chaining.
  const history = document.data?.history ?? [];
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading revision from document.data; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  const revision = document.data?.revision;
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading id from revision; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  const index = history.findIndex((item) => item.id === revision?.id);
  const previewing =
    artifact.status === "streaming" && artifact.followLive !== false;
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading canEdit from document.data; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  const owned = !readOnly && document.data?.canEdit;
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve onSaved's awaited sequencing and rejected-Promise behavior. */
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
  /* oxlint-enable oxc/no-async-await */
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
    // oxlint-disable-next-line no-ternary -- Keep content as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
    content: previewing
      ? artifact.content
      : // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading content from editing.draft; preserve one receiver evaluation, skipped accesses and the existing revision?.content fallback. The app guidance prefers optional chaining. Keep the existing nullish guard when reading content from revision; preserve one receiver evaluation, skipped accesses and the existing revision?.content fallback. The app guidance prefers optional chaining.
        (editing.draft?.content ?? revision?.content ?? ""),
    currentVersionIndex: index,
    isCurrentVersion: index === history.length - 1,
    isReadonly: !editable,
    onSaveContent: editing.edit,
    // oxlint-disable-next-line no-ternary -- Keep status as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
    status: previewing ? ("streaming" as const) : ("idle" as const),
  };
  const selectRevision = (id: string | undefined): void => {
    setSelectedRevisionId(id);
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing current own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    setArtifact((current) => ({ ...current, followLive: id === undefined }));
  };
  const restoreVersion = (): void => {
    const latest = history.at(-1);
    if (!revision || !latest) {
      return;
    }
    editing.restore(revision.content, revision.title, latest.id);
  };
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading id from history[index - 1]; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  const previousRevisionId = history[index - 1]?.id;
  const canCompare = Boolean(previousRevisionId && !editing.draft);
  const comparing = showChanges && canCompare;
  const actionsDisabled =
    document.isError ||
    documentActionsDisabled ||
    !editable ||
    Boolean(editing.draft);
  let subtitle = "Loading document…";
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading createdAt from revision; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
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
      {}
      <Artifact
        aria-label="Document"
        // oxlint-disable-next-line react/forbid-component-props -- Artifact accepts className in its styling contract; preserve this caller's layout and appearance.
        className="relative h-full min-h-0 w-full rounded-none border-0"
        data-testid="artifact"
        {...artifactRegionProps}
      >
        <ArtifactHeader
          // oxlint-disable-next-line react/forbid-component-props -- ArtifactHeader accepts className in its styling contract; preserve this caller's layout and appearance.
          className="bg-background/80 shrink-0 items-start p-2"
        >
          <div className="flex min-w-0 items-start gap-4">
            <ArtifactClose
              // oxlint-disable-next-line react/forbid-component-props -- ArtifactClose accepts className in its styling contract; preserve this caller's layout and appearance.
              className="hover:bg-accent h-fit p-2"
              onClick={closeArtifact}
              variant="outline"
            />
            <div className="min-w-0">
              <ArtifactTitle
                // oxlint-disable-next-line react/forbid-component-props -- ArtifactTitle accepts className in its styling contract; preserve this caller's layout and appearance.
                className="break-words"
              >
                {
                  // oxlint-disable-next-line no-ternary -- Keep JSX child as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
                  previewing
                    ? artifact.title
                    : // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading title from revision; preserve one receiver evaluation, skipped accesses and the existing artifact.title fallback. The app guidance prefers optional chaining.
                      (revision?.title ?? artifact.title)
                }
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
              onPrevious={() =>
                selectRevision(
                  /* oxlint-disable oxc/no-optional-chaining -- Keep the existing nullish guard when reading id from history[index - 1]; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining. */
                  history[index - 1]?.id
                  /* oxlint-enable oxc/no-optional-chaining */
                )
              }
              onNext={() =>
                selectRevision(
                  // oxlint-disable-next-line no-ternary -- Keep selectRevision argument as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
                  index + 1 === history.length - 1
                    ? undefined
                    : // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading id from history[index + 1]; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
                      history[index + 1]?.id
                )
              }
              run={
                DocumentRun && (
                  <DocumentRun
                    documentId={artifact.documentId}
                    revisionId={revision.id}
                    title={revision.title}
                    kind={revision.kind}
                    messages={messages}
                    disabled={actionsDisabled}
                    // oxlint-disable-next-line no-ternary -- Keep onAction JSX attribute as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
                    onAction={owned ? onDocumentAction : undefined}
                    buttonOnly
                  />
                )
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
        <ArtifactContent
          // oxlint-disable-next-line react/forbid-component-props -- ArtifactContent accepts className in its styling contract; preserve this caller's layout and appearance.
          className="flex min-h-0 flex-1 flex-col overflow-hidden p-0"
        >
          {document.isPending && !previewing && (
            <DocumentSkeleton artifactKind={artifact.kind} />
          )}
          {document.isError && (
            <div className="space-y-2 p-4" role="alert">
              <p>
                This document could not be loaded. It may no longer be shared.
              </p>
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
                // oxlint-disable-next-line no-ternary -- Keep comparison JSX attribute as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
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
            // oxlint-disable-next-line typescript/prefer-nullish-coalescing -- #602: These independent conditions are combined as a boolean disjunction, not a nullish fallback.
            (onDocumentAction || onStop) &&
            revision && (
              <EveDocumentAssistantActions
                disabled={actionsDisabled}
                busy={executionBusy}
                onStop={onStop}
                documentId={artifact.documentId}
                kind={revision.kind}
                onAction={
                  // oxlint-disable-next-line no-ternary -- Keep onAction JSX attribute as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
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
            {DocumentRun && (
              <DocumentRun
                disabled={actionsDisabled}
                documentId={artifact.documentId}
                kind={revision.kind}
                messages={messages}
                // oxlint-disable-next-line no-ternary -- Keep onAction JSX attribute as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
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
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, no-undefined, react-perf/jsx-no-jsx-as-prop, react-perf/jsx-no-new-function-as-prop, react-perf/jsx-no-new-object-as-prop, react/jsx-max-depth, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions */

/* oxlint-disable max-lines-per-function, no-magic-numbers, no-undefined, react-perf/jsx-no-new-function-as-prop, react/no-multi-comp, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions -- Layout: max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 65); no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; ; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including message); typescript/promise-function-async: return the existing promise directly; adding async changes synchronous throw behavior and promise identity; typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including ownerId). */

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
  // oxlint-disable-next-line oxc/no-optional-chaining, no-ternary -- Keep the existing nullish guard when calling isExecutionBusy; preserve one receiver evaluation, skipped call arguments and the undefined short-circuit result. The app guidance prefers optional chaining.; no-ternary: Keep busy as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
  const busy = ownerId ? isExecutionBusy?.(ownerId) : undefined;
  // oxlint-disable-next-line oxc/no-optional-chaining, no-ternary -- Keep the existing nullish guard when calling getExecutionMessages; preserve one receiver evaluation, skipped call arguments and the undefined short-circuit result. The app guidance prefers optional chaining.; no-ternary: Keep ownerMessages as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
  const ownerMessages = ownerId ? getExecutionMessages?.(ownerId) : undefined;
  useEffect(() => {
    if (artifact.status !== "streaming" || !artifact.previewCallId) {
      return;
    }
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading flatMap from ownerMessages; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
    const call = ownerMessages
      ?.flatMap((message) => message.parts)
      .find(
        (part) =>
          part.type === "dynamic-tool" &&
          part.toolCallId === artifact.previewCallId
      );
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading type from call; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
    if (call?.type === "dynamic-tool" && call.state === "output-available") {
      const result = eveDocumentResult.safeParse(call.output);
      if (result.success) {
        setArtifact((current) => ({
          // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing current own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
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
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing current own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
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
      <ChatLayoutMain
        defaultSize={
          // oxlint-disable-next-line no-ternary -- Keep defaultSize JSX attribute as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
          visible ? 65 : 100
        }
      >
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
              // oxlint-disable-next-line no-ternary -- Keep onStop JSX attribute as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
              ownerId && onStopExecution
                ? () => onStopExecution(ownerId)
                : undefined
            }
            key={`${artifact.conversationId ?? conversationId}:${artifact.documentId}`}
            messages={ownerMessages ?? messages}
            onDocumentAction={
              // oxlint-disable-next-line no-ternary -- Keep onDocumentAction JSX attribute as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
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
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (EveArtifactLayout); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable max-lines-per-function, no-magic-numbers, no-undefined, react-perf/jsx-no-new-function-as-prop, react/no-multi-comp, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions */
/* oxlint-disable react/jsx-max-depth, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- EveArtifactLayout: ; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

export const EveArtifactLayout = (
  props: {
    children: ReactNode;
    conversationId?: string;
    logicalChatId?: string;
    readOnly?: boolean;
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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable react/jsx-max-depth, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable max-lines -- eve-artifact-layout keeps its cohesive feature and related render helpers together; splitting this module requires a separate public-boundary review. This exception covers the file-length metric. */
