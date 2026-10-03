"use client";
/* oxlint-disable sort-imports -- Oxfmt owns this module's external, type-only, and alias import groups; its case-insensitive order conflicts with this declaration-order rule. */

import React, { useEffect, useMemo, useRef, useState } from "react";

import {
  Conversation,
  ConversationContent,
} from "@/components/ai-elements/conversation";
import { ChatWelcomeView } from "@/components/chat/chat-welcome-view";
import { ThinkingMessage } from "@/components/thinking-message";
import {
  expandSelectedModelValue,
  getPrimarySelectedModelId,
} from "@/lib/ai/types";
import type { SelectedModelValue, UiToolName } from "@/lib/ai/types";
import { CreationRejectedError } from "@/lib/eve/create-conversation";
import { draftMessage, restoreDraft } from "@/lib/eve/draft";
import {
  finishCreation,
  prepareSelectedCreation,
  readCreationRequest,
} from "@/lib/eve/pending-create";
import { resolveCreationRequest } from "@/lib/eve/resolve-creation-request";
import {
  useDefaultModel,
  useModelChange,
} from "@/providers/default-model-provider";
/* oxlint-disable import/max-dependencies -- ./eve-composer import: import/max-dependencies: these direct dependencies compose this feature without hiding imports behind a barrel. */

import { EveComposer } from "./eve-composer";
/* oxlint-enable import/max-dependencies */
import { EveCreationRecovery } from "./eve-creation-recovery";
import { EveInitialMessage } from "./eve-initial-message";
import { useEveRuntime } from "./eve-logical-context";
import { EveOptimisticResponseGroup } from "./eve-optimistic-response-group";
import { useEveAttachments } from "./use-eve-attachments";
/* oxlint-enable sort-imports */
/* oxlint-disable import/no-named-export, import/prefer-default-export, max-lines-per-function, max-statements, no-ternary, no-undefined, oxc/no-async-await, oxc/no-optional-chaining, oxc/no-rest-spread-properties, react-perf/jsx-no-new-function-as-prop, react-perf/jsx-no-new-object-as-prop, react/forbid-component-props, react/jsx-max-depth, react/jsx-no-literals, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, typescript/strict-void-return, unicorn/no-null -- NewEveConversation: import/no-named-export: existing callers import this public component, type, or hook by name; import/prefer-default-export: the existing named import remains stable when this module adds another public declaration; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; no-ternary: derive the existing render or state alternative inline without introducing another mutable state variable (including "modelIds" in pending ? pending.modelIds : undefined); no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; oxc/no-async-await: await preserves ordered requests and catch behavior in this feature operation; oxc/no-optional-chaining: optional access preserves the absent prop, query result, or browser capability fallback (including onPendingChange?.(busy || retained)); oxc/no-rest-spread-properties: compose immutable state or forward the remaining typed props without mutating the caller object; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react-perf/jsx-no-new-object-as-prop: this prop object derives from current render state or feature styling; hoisting changes its ownership; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/jsx-no-literals: these existing labels and accessible text are this feature content; localization is a separate content migration; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including operation: ReturnType<typeof prepareSelectedCreation>); typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including projectId); typescript/strict-void-return: this library event API ignores the return value while the existing handler owns its async pending and error lifecycle; unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

export const NewEveConversation = ({
  ownerId,
  projectId,
  onPendingChange,
}: {
  ownerId: string;
  projectId?: string;
  onPendingChange?: (pending: boolean) => void;
}) => {
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
  ) => {
    setDraft(restoreDraft(operation.message).text);
    setSelectedTool(operation.selectedTool ?? null);
    setRetainedModelId("modelIds" in operation ? undefined : operation.modelId);
    setRetainedModelIds(
      "modelIds" in operation ? operation.modelIds : undefined
    );
    setOptimisticComparison("modelIds" in operation ? operation : undefined);
    setRetainedOperationId(operation.operationId);
  };
  const submit = async () => {
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
  const composer = (
    <>
      <EveComposer
        // oxlint-disable-next-line jsx-a11y/no-autofocus -- #536: Preserve the new-conversation typing workflow; changing initial page focus requires accessibility and UX review.
        autoFocus
        status={busy ? "submitted" : "ready"}
        disabled={busy}
        draft={busy ? "" : draft}
        files={busy ? { ...files, attachments: [] } : files}
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
  if (busy) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <Conversation>
          <ConversationContent className="mx-auto w-full max-w-3xl">
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
/* oxlint-enable import/no-named-export, import/prefer-default-export, max-lines-per-function, max-statements, no-ternary, no-undefined, oxc/no-async-await, oxc/no-optional-chaining, oxc/no-rest-spread-properties, react-perf/jsx-no-new-function-as-prop, react-perf/jsx-no-new-object-as-prop, react/forbid-component-props, react/jsx-max-depth, react/jsx-no-literals, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, typescript/strict-void-return, unicorn/no-null */
