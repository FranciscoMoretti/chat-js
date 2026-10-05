"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { JSX as ReactJSX } from "react";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import {
  Conversation,
  ConversationContent,
} from "@/components/ai-elements/conversation";
/* oxlint-enable sort-imports */
import { ChatWelcomeView } from "@/components/chat/chat-welcome-view";
import { ThinkingMessage } from "@/components/thinking-message";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { SelectedModelValue, UiToolName } from "@/lib/ai/types";
/* oxlint-enable sort-imports */
import {
  expandSelectedModelValue,
  getPrimarySelectedModelId,
} from "@/lib/ai/types";
import { CreationRejectedError } from "@/lib/eve/create-conversation";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { draftMessage, restoreDraft } from "@/lib/eve/draft";
/* oxlint-enable sort-imports */
import {
  finishCreation,
  prepareSelectedCreation,
  readCreationRequest,
} from "@/lib/eve/pending-create";
import { resolveCreationRequest } from "@/lib/eve/resolve-creation-request";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  useDefaultModel,
  useModelChange,
} from "@/providers/default-model-provider";
/* oxlint-enable sort-imports */
/* oxlint-disable import/max-dependencies -- ./eve-composer import: import/max-dependencies: these direct dependencies compose this feature without hiding imports behind a barrel. */

import { EveComposer } from "./eve-composer";
/* oxlint-enable import/max-dependencies */
import { EveCreationRecovery } from "./eve-creation-recovery";
import { EveInitialMessage } from "./eve-initial-message";
import { useEveRuntime } from "./eve-logical-context";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { EveOptimisticResponseGroup } from "./eve-optimistic-response-group";
/* oxlint-enable sort-imports */
import { useEveAttachments } from "./use-eve-attachments";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (NewEveConversation); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable react/jsx-no-literals -- NewEveConversation renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */
/* oxlint-disable max-lines-per-function, max-statements, no-undefined, react-perf/jsx-no-new-function-as-prop, react-perf/jsx-no-new-object-as-prop, react/jsx-max-depth, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, typescript/strict-void-return, unicorn/no-null -- NewEveConversation: ; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react-perf/jsx-no-new-object-as-prop: this prop object derives from current render state or feature styling; hoisting changes its ownership; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including operation: ReturnType<typeof prepareSelectedCreation>); typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including projectId); typescript/strict-void-return: this library event API ignores the return value while the existing handler owns its async pending and error lifecycle; unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

export const NewEveConversation = ({
  ownerId,
  projectId,
  onPendingChange,
}: {
  readonly ownerId: string;
  readonly projectId?: string;
  readonly onPendingChange?: (pending: boolean) => void;
}): ReactJSX.Element => {
  const openRuntime = useEveRuntime();
  const scope = useMemo(
    () =>
      typeof projectId === "string" && projectId !== ""
        ? { projectId }
        : undefined,
    [projectId]
  );
  const selectedModel = useDefaultModel();
  const changeModel = useModelChange();
  const [selection, setSelection] = useState<SelectedModelValue>();
  const files = useEveAttachments();
  const { setAttachments } = files;
  const [draft, setDraft] = useState("");
  const [selectedTool, setSelectedTool] = useState<UiToolName | null>(null);
  const [projectRejected, setProjectRejected] = useState(false);
  const [retainedOperationId, setRetainedOperationId] = useState<string>();
  const retained = retainedOperationId !== undefined;
  const [retainedModelId, setRetainedModelId] = useState<string>();
  const [retainedModelIds, setRetainedModelIds] = useState<string[]>();
  const [failure, setFailure] = useState("");
  const [busy, setBusy] = useState(false);
  const [optimisticComparison, setOptimisticComparison] =
    useState<
      Extract<
        ReturnType<typeof prepareSelectedCreation>,
        { modelIds: string[] }
      >
    >();
  const lock = useRef(false);
  useEffect(() => {
    onPendingChange?.(busy || retained);
  }, [busy, retained, onPendingChange]);
  useEffect(() => {
    try {
      const pending = readCreationRequest(sessionStorage, ownerId, scope);
      if (pending) {
        // oxlint-disable-next-line react/set-state-in-effect -- Hydrate the recovery composer from its durable request.
        setRetainedOperationId(pending.operationId);
        setSelectedTool(pending.selectedTool ?? null);
        const restored = restoreDraft(pending.message);
        setDraft(restored.text);
        setAttachments(restored.attachments);
        setRetainedModelIds(
          "modelIds" in pending ? pending.modelIds : undefined
        );
        setRetainedModelId("modelIds" in pending ? undefined : pending.modelId);
      }
    } catch {
      setFailure("The saved draft could not be restored.");
    }
  }, [ownerId, scope, setAttachments]);
  const retainOperation = (
    operation: ReturnType<typeof prepareSelectedCreation>
  ): void => {
    setDraft(restoreDraft(operation.message).text);
    setSelectedTool(operation.selectedTool ?? null);
    setRetainedModelId("modelIds" in operation ? undefined : operation.modelId);
    setRetainedModelIds(
      "modelIds" in operation ? operation.modelIds : undefined
    );
    setOptimisticComparison("modelIds" in operation ? operation : undefined);
    setRetainedOperationId(operation.operationId);
  };
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve submit's awaited sequencing and rejected-Promise behavior. */
  const submit = async (): Promise<void> => {
    if (lock.current) {
      return;
    }
    lock.current = true;
    setBusy(true);
    setFailure("");
    let navigating = false;
    /* oxlint-disable react/todo -- Preserve operation lock cleanup across navigation and errors. */
    try {
      const modelIds = expandSelectedModelValue(selection ?? selectedModel);
      const operation = prepareSelectedCreation(
        sessionStorage,
        ownerId,
        draftMessage(draft, files.attachments),
        modelIds,
        scope,
        selectedTool ?? undefined
      );
      retainOperation(operation);
      const binding = await resolveCreationRequest(
        sessionStorage,
        ownerId,
        operation,
        scope
      );
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing binding own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      await openRuntime({ ...binding, operation, ownerId });
      navigating = true;
    } catch (error) {
      if (
        error instanceof CreationRejectedError &&
        error.projectUnavailable &&
        projectId
      ) {
        setProjectRejected(true);
      } else if (error instanceof CreationRejectedError) {
        finishCreation(sessionStorage, ownerId, scope);
        setRetainedModelId(undefined);
        setRetainedModelIds(undefined);
        setOptimisticComparison(undefined);
        setRetainedOperationId(undefined);
      }
      setFailure(
        error instanceof Error
          ? error.message
          : "Unable to start. Retain this operation before retrying."
      );
      // oxlint-disable-next-line react/todo -- React Compiler cannot analyze required operation lock cleanup in finally.
    } finally {
      lock.current = false;
      if (!navigating) {
        setBusy(false);
      }
    }
    /* oxlint-enable react/todo */
  };
  /* oxlint-enable oxc/no-async-await */
  if (projectRejected || (retained && !busy)) {
    return (
      <EveCreationRecovery
        firstMessage={draft}
        initiallyRejected={projectRejected}
        operationId={retainedOperationId}
        ownerId={ownerId}
        scope={scope}
      />
    );
  }
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve composer's awaited sequencing and rejected-Promise behavior. */
  const composer = (
    <>
      <EveComposer
        // oxlint-disable-next-line jsx-a11y/no-autofocus -- #536: Preserve the new-conversation typing workflow; changing initial page focus requires accessibility and UX review.
        autoFocus
        status={busy ? "submitted" : "ready"}
        disabled={busy}
        draft={busy ? "" : draft}
        files={
          busy /* oxlint-disable oxc/no-rest-spread-properties -- Keep the existing files own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement. */
            ? { ...files, attachments: [] }
            : /* oxlint-enable oxc/no-rest-spread-properties */ files
        }
        modelSelection={{
          onChange: async (value) => {
            setSelection(value);
            const primary = getPrimarySelectedModelId(value);
            if (primary) {
              await changeModel(primary);
            }
          },
          value: selection ?? selectedModel,
        }}
        onDraftChange={(value) => {
          // Clearing the controlled editor must not erase the saved send intent.
          if (!busy) {
            setDraft(value);
          }
        }}

        // oxlint-disable-next-line typescript/no-misused-promises -- #585: Submission owns creation admission and retained recovery state; the composer delegates that lifecycle.
        onSubmit={submit}
        onToolChange={setSelectedTool}
        readOnly={retained}
        retainedModelId={retainedModelId}
        retainedModelIds={retainedModelIds}
        selectedTool={selectedTool}
      />
      {failure && <p role="alert">{failure}</p>}
    </>
  );
  /* oxlint-enable oxc/no-async-await */
  if (busy) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <Conversation>
          <ConversationContent
            // oxlint-disable-next-line react/forbid-component-props -- ConversationContent accepts className in its styling contract; preserve this caller's layout and appearance.
            className="mx-auto w-full max-w-3xl"
          >
            {optimisticComparison ? (
              <EveOptimisticResponseGroup operation={optimisticComparison} />
            ) : (
              <EveInitialMessage
                message={draftMessage(draft, files.attachments)}
              />
            )}
            {!optimisticComparison && <ThinkingMessage />}
            <output className="sr-only">Sending…</output>
          </ConversationContent>
        </Conversation>
        <div className="mx-auto w-full max-w-3xl p-4">{composer}</div>
      </div>
    );
  }
  return projectId ? composer : <ChatWelcomeView>{composer}</ChatWelcomeView>;
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable max-lines-per-function, max-statements, no-undefined, react-perf/jsx-no-new-function-as-prop, react-perf/jsx-no-new-object-as-prop, react/jsx-max-depth, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, typescript/strict-void-return, unicorn/no-null */
