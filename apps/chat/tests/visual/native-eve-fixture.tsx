import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TRPCClientError, createTRPCClient } from "@trpc/client";
/* oxlint-disable sort-imports -- Pinned Oxfmt groups imports by module, while sort-imports requires a different binding-name or binding-syntax order. */
import type { OperationResultObserver, TRPCLink } from "@trpc/client";
/* oxlint-enable sort-imports */
import { observable } from "@trpc/server/observable";
/* oxlint-disable sort-imports -- Pinned Oxfmt groups imports by module, while sort-imports requires a different binding-name or binding-syntax order. */
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
/* oxlint-enable sort-imports */
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
/* oxlint-disable sort-imports -- Pinned Oxfmt groups imports by module, while sort-imports requires a different binding-name or binding-syntax order. */
import React, { act } from "react";
/* oxlint-enable sort-imports */
import { expect, vi } from "vitest";

import { EveDeletionProvider } from "@/components/eve/eve-deletion-provider";
import { EveRuntimeProvider } from "@/components/eve/eve-runtime-provider";
import { SidebarProvider } from "@/components/ui/sidebar";
/* oxlint-disable sort-imports -- Pinned Oxfmt groups imports by module, while sort-imports requires a different binding-name or binding-syntax order. */
/* oxlint-disable import/max-dependencies -- This fixture composes the actual Next, query, tRPC, session, catalog, sidebar, deletion and Eve providers directly rather than hiding their dependencies in a barrel. */
import type { AppModelDefinition } from "@/lib/ai/app-models";
/* oxlint-enable import/max-dependencies */
/* oxlint-enable sort-imports */
import type { Session } from "@/lib/auth";
/* oxlint-disable sort-imports -- Pinned Oxfmt groups imports by module, while sort-imports requires a different binding-name or binding-syntax order. */
import type { ReadonlyReactNode } from "@/lib/readonly-react-node";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Pinned Oxfmt groups imports by module, while sort-imports requires a different binding-name or binding-syntax order. */
import { ChatModelsProvider } from "@/providers/chat-models-provider";
/* oxlint-enable sort-imports */
import { DefaultModelProvider } from "@/providers/default-model-provider";
import { SessionProvider } from "@/providers/session-provider";
import { mount } from "@/tests/visual/primitive-mount";
/* oxlint-disable sort-imports -- Pinned Oxfmt groups imports by module, while sort-imports requires a different binding-name or binding-syntax order. */
import { TRPCProvider } from "@/trpc/react";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Pinned Oxfmt groups imports by module, while sort-imports requires a different binding-name or binding-syntax order. */
import type { AppRouter } from "@/trpc/routers/_app";
/* oxlint-enable sort-imports */

/* oxlint-disable sort-imports -- Pinned Oxfmt groups imports by module, while sort-imports requires a different binding-name or binding-syntax order. */
import "@/tests/visual/sandbox.css";
/* oxlint-enable sort-imports */

vi.mock("@/lib/auth-client", () => ({
  default: {
    useSession: (): {
      readonly data: Session;
      readonly error: null;
      readonly isPending: false;
    } => ({
      data: {
        session: {
          createdAt: new Date("2026-09-25T10:00:00Z"),
          expiresAt: new Date("2026-10-25T10:00:00Z"),
          id: "fixture-session",
          token: "local-fixture-token",
          updatedAt: new Date("2026-09-25T10:00:00Z"),
          userId: "fixture-user",
        },
        user: {
          createdAt: new Date("2026-09-25T10:00:00Z"),
          email: "fixture@example.test",
          emailVerified: true,
          id: "fixture-user",
          name: "Fixture member",
          updatedAt: new Date("2026-09-25T10:00:00Z"),
        },
      },
      // oxlint-disable-next-line unicorn/no-null -- Better Auth reports an absent error as null; keep the native settled-session result.
      error: null,
      isPending: false,
    }),
  },
}));
const models: AppModelDefinition[] = [
  {
    apiModelId: "openai/gpt-4.1",
    context_window: 128_000,
    description: "Controlled catalog text model",
    id: "openai/gpt-4.1",
    input: { audio: false, image: true, pdf: true, text: true, video: false },
    max_tokens: 4096,
    name: "Fixture Alpha",
    object: "model",
    output: { audio: false, image: false, text: true, video: false },
    owned_by: "openai",
    pricing: { input: "0.1", output: "0.2" },
    reasoning: false,
    toolCall: true,
    type: "language",
  },
  {
    apiModelId: "google/gemini-2.5-flash",
    context_window: 128_000,
    description: "Controlled catalog text model",
    id: "google/gemini-2.5-flash",
    input: { audio: false, image: true, pdf: true, text: true, video: false },
    max_tokens: 4096,
    name: "Fixture Beta",
    object: "model",
    output: { audio: false, image: false, text: true, video: false },
    owned_by: "google",
    pricing: { input: "0.1", output: "0.2" },
    reasoning: false,
    toolCall: true,
    type: "language",
  },
];
const router = {
  back: vi.fn(),
  bfcacheId: "native-model-fixture",
  forward: vi.fn(),
  prefetch: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
};

type HistoryMode = "refetch" | "next";
type Observer = Readonly<OperationResultObserver<AppRouter, unknown>>;
const historyCursor = {
  id: "fixture-next",
  isPinned: false,
  updatedAt: "2026-09-25T10:00:00Z",
};
const respondPreferences = (observer: Observer): void => {
  observer.next({
    result: {
      data: models.map((model: { readonly id: AppModelDefinition["id"] }) => ({
        enabled: true,
        modelId: model.id,
      })),
    },
  });
  observer.complete();
};
const respondProjects = (observer: Observer): void => {
  observer.next({ result: { data: [] } });
  observer.complete();
};
interface FixtureOperation {
  readonly input: unknown;
  readonly path: string;
}
const createHistoryResponse = (
  historyMode: HistoryMode
): {
  readonly handle: (input: unknown, observer: Observer) => void;
  readonly inputs: readonly unknown[];
} => {
  const inputs: unknown[] = [];
  let deliveredFirstPage = false;
  const handle = (input: unknown, observer: Observer): void => {
    inputs.push(input);
    if (historyMode === "next" && !deliveredFirstPage) {
      deliveredFirstPage = true;
      observer.next({
        result: { data: { items: [], nextCursor: historyCursor } },
      });
      observer.complete();
      return;
    }
    observer.error(
      TRPCClientError.from(new Error("Fixture history unavailable"))
    );
  };
  return { handle, inputs };
};
const missingIdentity = (): void => {
  throw new Error("No actual identity query registered");
};
const createIdentityResponse = (): {
  readonly handle: (observer: Observer) => void;
  readonly reject: () => void;
} => {
  let rejectIdentity = missingIdentity;
  const handle = (observer: Observer): void => {
    rejectIdentity = (): void =>
      observer.error(TRPCClientError.from(new Error("Fixture unavailable")));
  };
  return { handle, reject: (): void => rejectIdentity() };
};
const createRequestResponders = (
  historyResponse: (input: unknown, observer: Observer) => void,
  identityResponse: (observer: Observer) => void
): ReadonlyMap<string, (op: FixtureOperation, observer: Observer) => void> =>
  new Map([
    [
      "settings.getModelPreferences",
      (_op: FixtureOperation, observer: Observer): void =>
        respondPreferences(observer),
    ],
    [
      "project.list",
      (_op: FixtureOperation, observer: Observer): void =>
        respondProjects(observer),
    ],
    [
      "eve.list",
      (op: FixtureOperation, observer: Observer): void =>
        historyResponse(op.input, observer),
    ],
    [
      "eve.get",
      (_op: FixtureOperation, observer: Observer): void =>
        identityResponse(observer),
    ],
  ]);
const createNativeClient = (
  historyMode: HistoryMode
): {
  readonly client: ReturnType<typeof createTRPCClient<AppRouter>>;
  readonly historyInputs: readonly unknown[];
  readonly rejectIdentity: () => void;
  readonly requests: readonly string[];
} => {
  const requests: string[] = [];
  const history = createHistoryResponse(historyMode);
  const identity = createIdentityResponse();
  const responders = createRequestResponders(history.handle, identity.handle);
  const client = createTRPCClient<AppRouter>({
    links: [
      (): ReturnType<TRPCLink<AppRouter>> =>
        ({
          op,
        }: {
          readonly op: FixtureOperation;
        }): ReturnType<ReturnType<TRPCLink<AppRouter>>> =>
          observable((observer: Observer): void => {
            requests.push(op.path);
            const respond = responders.get(op.path);
            if (!respond) {
              observer.error(
                TRPCClientError.from(
                  new Error(`Unhandled native fixture procedure ${op.path}`)
                )
              );
              return;
            }
            respond(op, observer);
          }),
    ],
  });
  return {
    client,
    historyInputs: history.inputs,
    rejectIdentity: identity.reject,
    requests,
  };
};
/* oxlint-disable oxc/no-async-await -- Await native query, React and browser lifecycle completion before state assertions, captures and cleanup. */
const settleNativeQueries = async (
  queryClient: Readonly<Pick<QueryClient, "isFetching">>
): Promise<void> => {
  await act(async () => {
    /* oxlint-disable eslint/no-magic-numbers -- Wait until no fixed-response queries are fetching; the intentionally deferred Eve identity request remains pending. */
    await expect
      .poll(() =>
        queryClient.isFetching({
          predicate: (query: { readonly queryKey: readonly unknown[] }) =>
            !JSON.stringify(query.queryKey).includes('"get"'),
        })
      )
      .toBe(0);
    /* oxlint-enable eslint/no-magic-numbers */
  });
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Await native query, React and browser lifecycle completion before state assertions, captures and cleanup. */
const mountNative = async (
  children: ReadonlyReactNode,
  historyMode: HistoryMode = "refetch"
): Promise<{
  readonly fixture: Awaited<ReturnType<typeof mount>>;
  readonly historyInputs: readonly unknown[];
  readonly queryClient: QueryClient;
  readonly rejectIdentity: () => void;
  readonly requests: readonly string[];
}> => {
  const { client, historyInputs, rejectIdentity, requests } =
    createNativeClient(historyMode);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const /* oxlint-disable react/jsx-max-depth -- The actual Next router, query, tRPC, session, catalog, sidebar, deletion and Eve providers must wrap these fixtures in their native order. */
    fixture = await mount(
      <AppRouterContext.Provider value={router}>
        <QueryClientProvider client={queryClient}>
          <TRPCProvider trpcClient={client} queryClient={queryClient}>
            <SessionProvider>
              <ChatModelsProvider models={models}>
                <DefaultModelProvider defaultModel="openai/gpt-4.1">
                  <PathnameContext.Provider value="/">
                    <SidebarProvider>
                      <EveDeletionProvider>
                        <EveRuntimeProvider ownerId="fixture-user">
                          {children}
                        </EveRuntimeProvider>
                      </EveDeletionProvider>
                    </SidebarProvider>
                  </PathnameContext.Provider>
                </DefaultModelProvider>
              </ChatModelsProvider>
            </SessionProvider>
          </TRPCProvider>
        </QueryClientProvider>
      </AppRouterContext.Provider>
    );
  /* oxlint-enable react/jsx-max-depth */
  await settleNativeQueries(queryClient);
  return { fixture, historyInputs, queryClient, rejectIdentity, requests };
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable import/no-named-export -- Keep the named fixture bindings (historyCursor, mountNative); enabled import/no-default-export and app guidance require named module APIs. */
export { historyCursor, mountNative };
/* oxlint-enable import/no-named-export */
