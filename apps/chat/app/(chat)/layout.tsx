/* oxlint-disable sort-imports -- Oxfmt owns this module's external, type-only, and alias import groups; its case-insensitive order conflicts with this declaration-order rule. */

import { cookies, headers } from "next/headers";
import React, { Suspense } from "react";

import { getChatModels } from "@/app/actions/get-chat-models";
import { AppSidebar } from "@/components/app-sidebar";
import { ChatLoadingShell } from "@/components/chat-loading-shell";
import { EveDeletionProvider } from "@/components/eve/eve-deletion-provider";
import { EveRuntimeProvider } from "@/components/eve/eve-runtime-provider";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import type { AppModelId } from "@/lib/ai/app-model-id";
/* oxlint-disable import/max-dependencies -- @/lib/config import: import/max-dependencies: these direct dependencies compose this feature without hiding imports behind a barrel. */
import { config } from "@/lib/config";
/* oxlint-enable import/max-dependencies */
import { isPlaywrightTestEnvironment } from "@/lib/constants";
import { resolveEvePrincipal } from "@/lib/eve/principal";
import { ANONYMOUS_LIMITS } from "@/lib/types/anonymous";
import { ChatModelsProvider } from "@/providers/chat-models-provider";
import { DefaultModelProvider } from "@/providers/default-model-provider";
import { SessionProvider, SessionSeed } from "@/providers/session-provider";
import { TRPCReactProvider } from "@/trpc/react";
import { HydrateClient, getQueryClient, trpc } from "@/trpc/server";
/* oxlint-disable import/no-relative-parent-imports -- ../../lib/auth import: import/no-relative-parent-imports: the fixture imports its adjacent feature directly without creating a test-only alias. */

import { auth } from "../../lib/auth";
/* oxlint-enable sort-imports */
/* oxlint-enable import/no-relative-parent-imports */

const sidebarInsetClassName = "[--header-height:calc(var(--spacing)*13)]";
/* oxlint-disable id-length, max-lines-per-function, max-statements, no-magic-numbers, no-ternary, oxc/no-async-await, oxc/no-optional-chaining, react/jsx-max-depth, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null -- ChatLayoutDynamic: id-length: retain conventional event, index, and generic identifiers in this existing callback contract; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 0); no-ternary: derive the existing render or state alternative inline without introducing another mutable state variable; oxc/no-async-await: await preserves ordered requests and catch behavior in this feature operation; oxc/no-optional-chaining: optional access preserves the absent prop, query result, or browser capability fallback (including cookieStore.get("chat-model")?.value); react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { children, }: { children: React.ReactNode; }); typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including session?.user?.id); unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

const ChatLayoutDynamic = async ({
  children,
}: {
  children: React.ReactNode;
}) => {
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

  const cookieModel = cookieStore.get("chat-model")?.value;
  const isAnonymous = !session?.user;

  const default_chat_model = config.ai.workflows.chat;
  let defaultModel: AppModelId =
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- #599: The model cookie is checked against available model IDs before use; catalog branding is not preserved by cookie-string and includes APIs.
    (cookieModel as AppModelId) ?? default_chat_model;

  if (typeof cookieModel === "string" && cookieModel !== "") {
    const modelExists = chatModels.some((m) => m.id === cookieModel);
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

  if (session?.user?.id) {
    const queryClient = getQueryClient();
    // "Lazy prefetch": don't await; pending queries are dehydrated + streamed.

    void queryClient.prefetchQuery(
      trpc.settings.getModelPreferences.queryOptions()
    );

    void queryClient.prefetchQuery(trpc.project.list.queryOptions());
  }

  return (
    <HydrateClient>
      <SessionSeed session={session} />

      <ChatModelsProvider models={chatModels}>
        <DefaultModelProvider defaultModel={defaultModel}>
          <KeyboardShortcuts />
          <EveRuntimeProvider
            key={principal?.ownerId ?? "anonymous"}
            ownerId={principal?.ownerId}
          >
            {children}
          </EveRuntimeProvider>
        </DefaultModelProvider>
      </ChatModelsProvider>
    </HydrateClient>
  );
};
/* oxlint-enable id-length, max-lines-per-function, max-statements, no-magic-numbers, no-ternary, oxc/no-async-await, oxc/no-optional-chaining, react/jsx-max-depth, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null */

/* oxlint-disable oxc/no-async-await, oxc/no-optional-chaining, react-perf/jsx-no-jsx-as-prop, react/forbid-component-props, react/jsx-max-depth, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types -- ChatLayout: oxc/no-async-await: await preserves ordered requests and catch behavior in this feature operation; oxc/no-optional-chaining: optional access preserves the absent prop, query result, or browser capability fallback (including cookieStore.get("sidebar_state")?.value); react-perf/jsx-no-jsx-as-prop: this component composition slot accepts an element from the current render; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { children }: { children: React.ReactNode }). */

const ChatLayout = async ({ children }: { children: React.ReactNode }) => {
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value === "true";

  const content = (
    <>
      <AppSidebar />
      <SidebarInset className={sidebarInsetClassName}>
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
/* oxlint-enable oxc/no-async-await, oxc/no-optional-chaining, react-perf/jsx-no-jsx-as-prop, react/forbid-component-props, react/jsx-max-depth, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */
/* oxlint-disable import/no-default-export -- layout route: import/no-default-export: Next.js loads this route entry point through its required default export. */

export default ChatLayout;
/* oxlint-enable import/no-default-export */
