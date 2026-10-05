import { cookies, headers } from "next/headers";
import type { JSX as ReactJSX } from "react";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import React, { Suspense } from "react";
/* oxlint-enable sort-imports */

import { getChatModels } from "@/app/actions/get-chat-models";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { AppSidebar } from "@/components/app-sidebar";
/* oxlint-enable sort-imports */
import { ChatLoadingShell } from "@/components/chat-loading-shell";
import { EveDeletionProvider } from "@/components/eve/eve-deletion-provider";
import { EveRuntimeProvider } from "@/components/eve/eve-runtime-provider";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
/* oxlint-enable sort-imports */
import type { AppModelId } from "@/lib/ai/app-model-id";
/* oxlint-disable import/max-dependencies -- @/lib/config import: import/max-dependencies: these direct dependencies compose this feature without hiding imports behind a barrel. */
import { config } from "@/lib/config";
/* oxlint-enable import/max-dependencies */
import { isPlaywrightTestEnvironment } from "@/lib/constants";
import { resolveEvePrincipal } from "@/lib/eve/principal";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { ANONYMOUS_LIMITS } from "@/lib/types/anonymous";
/* oxlint-enable sort-imports */
import { ChatModelsProvider } from "@/providers/chat-models-provider";
import { DefaultModelProvider } from "@/providers/default-model-provider";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { SessionProvider, SessionSeed } from "@/providers/session-provider";
/* oxlint-enable sort-imports */
import { preloadQuery } from "@/trpc/preload-query";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { TRPCReactProvider } from "@/trpc/react";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { HydrateClient, getQueryClient, trpc } from "@/trpc/server";
/* oxlint-enable sort-imports */
/* oxlint-disable import/no-relative-parent-imports -- ../../lib/auth import: import/no-relative-parent-imports: the fixture imports its adjacent feature directly without creating a test-only alias. */

import { auth } from "../../lib/auth";
/* oxlint-enable import/no-relative-parent-imports */

const sidebarInsetClassName = "[--header-height:calc(var(--spacing)*13)]";
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve ChatLayoutDynamic's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, react/jsx-max-depth, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null -- ChatLayoutDynamic: max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 0); react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { children, }: { children: React.ReactNode; }); typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including session?.user?.id); unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

const ChatLayoutDynamic = async ({
  children,
}: {
  children: React.ReactNode;
}): Promise<ReactJSX.Element> => {
  const [cookieStore, headersRes, chatModels] = await Promise.all([
    cookies(),
    headers(),
    getChatModels(),
  ]);
  const session = isPlaywrightTestEnvironment
    ? null
    : await auth.api.getSession({ headers: headersRes });
  const principal = isPlaywrightTestEnvironment
    ? null
    : await resolveEvePrincipal(headersRes);

  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading value from cookieStore.get(...); preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  const cookieModel = cookieStore.get("chat-model")?.value;
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading user from session; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  const isAnonymous = !session?.user;

  const default_chat_model = config.ai.workflows.chat;
  let defaultModel: AppModelId =
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- #599: The model cookie is checked against available model IDs before use; catalog branding is not preserved by cookie-string and includes APIs.
    (cookieModel as AppModelId) ?? default_chat_model;

  if (typeof cookieModel === "string" && cookieModel !== "") {
    const modelExists = chatModels.some((model) => model.id === cookieModel);
    if (!modelExists) {
      defaultModel = default_chat_model;
    } else if (isAnonymous) {
      const isModelAvailable = (
        ANONYMOUS_LIMITS.AVAILABLE_MODELS as readonly AppModelId[]
      )
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- #599: The model cookie is checked against available model IDs before use; catalog branding is not preserved by cookie-string and includes APIs.
        .includes(cookieModel as AppModelId);
      if (!isModelAvailable) {
        defaultModel = default_chat_model;
      }
    }
  }

  if (isAnonymous) {
    const anonymousModels =
      ANONYMOUS_LIMITS.AVAILABLE_MODELS as readonly AppModelId[];
    if (!anonymousModels.includes(defaultModel)) {
      defaultModel = anonymousModels[0] ?? default_chat_model;
    }
  }

  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading id from session.user; read user from session; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  if (session?.user?.id) {
    const queryClient = getQueryClient();
    // "Lazy prefetch": don't await; pending queries are dehydrated + streamed.

    // Preloading must swallow preload errors while pending queries are dehydrated and streamed.
    void preloadQuery(
      queryClient.query(trpc.settings.getModelPreferences.queryOptions())
    );

    // Preloading must swallow preload errors while pending queries are dehydrated and streamed.
    void preloadQuery(queryClient.query(trpc.project.list.queryOptions()));
  }

  return (
    <HydrateClient>
      <SessionSeed session={session} />

      <ChatModelsProvider models={chatModels}>
        <DefaultModelProvider defaultModel={defaultModel}>
          <KeyboardShortcuts />
          <EveRuntimeProvider
            key={
              /* oxlint-disable oxc/no-optional-chaining -- Keep the existing nullish guard when reading ownerId from principal; preserve one receiver evaluation, skipped accesses and the existing "anonymous" fallback. The app guidance prefers optional chaining. */
              principal?.ownerId ??
              /* oxlint-enable oxc/no-optional-chaining */ "anonymous"
            }
            ownerId={
              /* oxlint-disable oxc/no-optional-chaining -- Keep the existing nullish guard when reading ownerId from principal; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining. */
              principal?.ownerId
              /* oxlint-enable oxc/no-optional-chaining */
            }
          >
            {children}
          </EveRuntimeProvider>
        </DefaultModelProvider>
      </ChatModelsProvider>
    </HydrateClient>
  );
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve ChatLayout's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, react/jsx-max-depth, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null */

/* oxlint-disable react-perf/jsx-no-jsx-as-prop, react/jsx-max-depth, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- ChatLayout: ; react-perf/jsx-no-jsx-as-prop: this component composition slot accepts an element from the current render; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { children }: { children: React.ReactNode }). */

const ChatLayout = async ({
  children,
}: {
  children: React.ReactNode;
}): Promise<ReactJSX.Element> => {
  const cookieStore = await cookies();
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading value from cookieStore.get(...); preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  const defaultOpen = cookieStore.get("sidebar_state")?.value === "true";

  const content = (
    <>
      <AppSidebar />
      <SidebarInset
        // oxlint-disable-next-line react/forbid-component-props -- SidebarInset accepts className in its styling contract; preserve this caller's layout and appearance.
        className={sidebarInsetClassName}
      >
        <Suspense fallback={<ChatLoadingShell />}>
          <ChatLayoutDynamic>{children}</ChatLayoutDynamic>
        </Suspense>
      </SidebarInset>
    </>
  );
  return (
    <TRPCReactProvider>
      <SessionProvider>
        <SidebarProvider defaultOpen={defaultOpen}>
          <EveDeletionProvider>{content}</EveDeletionProvider>
        </SidebarProvider>
      </SessionProvider>
    </TRPCReactProvider>
  );
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable react-perf/jsx-no-jsx-as-prop, react/jsx-max-depth, react/no-multi-comp, typescript/prefer-readonly-parameter-types */
// oxlint-disable-next-line import/no-default-export -- Next.js 16.3 discovers this layout module and create-component-tree selects its default component ChatLayout.
export default ChatLayout;
