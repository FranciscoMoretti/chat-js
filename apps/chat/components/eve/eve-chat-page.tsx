/* oxlint-disable sort-imports -- Oxfmt owns this module's external, type-only, and alias import groups; its case-insensitive order conflicts with this declaration-order rule. */

import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import React from "react";
import { z } from "zod";

import { ChatHeaderView } from "@/components/chat-header-view";
import { getEveCopyOperation } from "@/lib/db/eve-copy-journal";
import { getEveChatPageConversation } from "@/lib/db/eve-queries";
import type { CreationScope } from "@/lib/eve/pending-create";
import { resolveEvePrincipal } from "@/lib/eve/principal";

import { DisposableGuestChat } from "./disposable-guest-chat";
/* oxlint-disable import/max-dependencies -- ./eve-artifact-layout import: import/max-dependencies: these direct dependencies compose this feature without hiding imports behind a barrel. */
import { EveArtifactLayout } from "./eve-artifact-layout";
/* oxlint-enable import/max-dependencies */
import { EveCopyButton } from "./eve-copy-button";
import { EveCreationRecovery } from "./eve-creation-recovery";
import { EveRuntimeRoute } from "./eve-runtime-provider";
import { NewEveConversation } from "./new-eve-conversation";
/* oxlint-enable sort-imports */
/* oxlint-disable import/no-named-export, import/prefer-default-export, init-declarations, max-lines-per-function, max-statements, no-magic-numbers, no-ternary, no-undefined, oxc/no-async-await, oxc/no-optional-chaining, react-perf/jsx-no-jsx-as-prop, react-perf/jsx-no-new-object-as-prop, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null -- EveChatPage: import/no-named-export: existing callers import this public component, type, or hook by name; import/prefer-default-export: the existing named import remains stable when this module adds another public declaration; init-declarations: branches initialize this value before use; an eager undefined initializer adds a second missing-value state; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 0); no-ternary: derive the existing render or state alternative inline without introducing another mutable state variable; no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; oxc/no-async-await: await preserves ordered requests and catch behavior in this feature operation; oxc/no-optional-chaining: optional access preserves the absent prop, query result, or browser capability fallback (including selected?.parentConversationId); react-perf/jsx-no-jsx-as-prop: this component composition slot accepts an element from the current render; react-perf/jsx-no-new-object-as-prop: this prop object derives from current render state or feature styling; hoisting changes its ownership; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { conversationId, }: { conversationId?: string; }); typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including conversationId); unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

// This server boundary selects the authenticated, recovery, comparison, and chat states.
// oxlint-disable-next-line eslint/complexity
export const EveChatPage = async ({
  conversationId,
}: {
  conversationId?: string;
}) => {
  const principal = await resolveEvePrincipal(await headers());
  if (!principal) {
    if (typeof conversationId === "string" && conversationId !== "") {
      redirect("/");
    }
    return <DisposableGuestChat />;
  }
  if (conversationId && !z.uuid().safeParse(conversationId).success) {
    notFound();
  }
  const selected =
    typeof conversationId === "string" && conversationId !== ""
      ? await getEveChatPageConversation(principal.ownerId, conversationId)
      : undefined;
  if (conversationId && !selected) {
    notFound();
  }
  let recoveryScope: CreationScope | undefined;
  if (selected?.parentConversationId) {
    recoveryScope = { conversationId: selected.parentConversationId };
  } else if (selected?.initialProjectId) {
    recoveryScope = { projectId: selected.initialProjectId };
  }
  const header = (
    <ChatHeaderView
      breadcrumb={
        selected ? (
          <h1 className="ml-2 truncate text-sm font-medium">
            {selected.title ?? selected.firstMessage.slice(0, 100)}
          </h1>
        ) : null
      }
    />
  );
  if (selected?.sessionId && selected.state === "bound") {
    return (
      <EveRuntimeRoute
        id={selected.id}
        chatId={selected.chatId}
        sessionId={selected.sessionId}
        ownerId={principal.ownerId}
        title={selected.title}
      />
    );
  }

  const copy =
    selected?.creationKind === "copy"
      ? await getEveCopyOperation(principal.ownerId, selected.operationId)
      : undefined;
  let content = (
    <NewEveConversation key={principal.ownerId} ownerId={principal.ownerId} />
  );
  if (selected) {
    content = (
      <EveCreationRecovery
        firstMessage={selected.firstMessage}
        key={selected.id}
        operationId={selected.operationId}
        ownerId={principal.ownerId}
        scope={recoveryScope}
      />
    );
  }
  if (copy && selected?.initialModelId) {
    content = (
      <EveCopyButton
        recovery={{
          modelId: selected.initialModelId,
          operationId: selected.operationId,
          sourceConversationId: copy.copy.sourceConversationId,
        }}
        sourceConversationId={copy.copy.sourceConversationId}
      />
    );
  }
  return (
    <EveArtifactLayout conversationId={conversationId}>
      <section className="flex h-full min-h-0 flex-col">
        {header}
        {content}
      </section>
    </EveArtifactLayout>
  );
};
/* oxlint-enable import/no-named-export, import/prefer-default-export, init-declarations, max-lines-per-function, max-statements, no-magic-numbers, no-ternary, no-undefined, oxc/no-async-await, oxc/no-optional-chaining, react-perf/jsx-no-jsx-as-prop, react-perf/jsx-no-new-object-as-prop, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null */
