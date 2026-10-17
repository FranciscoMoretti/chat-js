import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TRPCClientError, createTRPCClient } from "@trpc/client";
import type { OperationResultObserver, TRPCLink } from "@trpc/client";
import { observable } from "@trpc/server/observable";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import React, { act } from "react";
import { expect, vi } from "vitest";

import { EveDeletionProvider } from "@/components/eve/eve-deletion-provider";
import { EveRuntimeProvider } from "@/components/eve/eve-runtime-provider";
import { SidebarProvider } from "@/components/ui/sidebar";
import type { AppModelDefinition } from "@/lib/ai/app-models";
import type { Session } from "@/lib/auth";
import type { ReadonlyReactNode } from "@/lib/readonly-react-node";
import { ChatModelsProvider } from "@/providers/chat-models-provider";
import { DefaultModelProvider } from "@/providers/default-model-provider";
import { SessionProvider } from "@/providers/session-provider";
import { mount } from "@/tests/visual/primitive-mount";
import { TRPCProvider } from "@/trpc/react";
import type { AppRouter } from "@/trpc/routers/_app";

import "@/tests/visual/sandbox.css";

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
    rejectIdentity = (): void => {
      observer.error(TRPCClientError.from(new Error("Fixture unavailable")));
    };
  };
  return {
    handle,
    reject: (): void => {
      rejectIdentity();
    },
  };
};
const createRequestResponders = (
  historyResponse: (input: unknown, observer: Observer) => void,
  identityResponse: (observer: Observer) => void
): ReadonlyMap<string, (op: FixtureOperation, observer: Observer) => void> =>
  new Map([
    [
      "settings.getModelPreferences",
      (_op: FixtureOperation, observer: Observer): void => {
        respondPreferences(observer);
      },
    ],
    [
      "project.list",
      (_op: FixtureOperation, observer: Observer): void => {
        respondProjects(observer);
      },
    ],
    [
      "eve.list",
      (op: FixtureOperation, observer: Observer): void => {
        historyResponse(op.input, observer);
      },
    ],
    [
      "eve.sendReceipt",
      (_op: FixtureOperation, observer: Observer): void => {
        observer.next({ result: { data: null } });
        observer.complete();
      },
    ],
    [
      "eve.get",
      (_op: FixtureOperation, observer: Observer): void => {
        identityResponse(observer);
      },
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
const settleNativeQueries = async (
  queryClient: Readonly<Pick<QueryClient, "isFetching">>
): Promise<void> => {
  await act(async () => {
    await expect
      .poll(() =>
        queryClient.isFetching({
          predicate: (query: { readonly queryKey: readonly unknown[] }) =>
            !JSON.stringify(query.queryKey).includes('"get"'),
        })
      )
      .toBe(0);
  });
};
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
  const fixture = await mount(
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
  await settleNativeQueries(queryClient);
  return { fixture, historyInputs, queryClient, rejectIdentity, requests };
};
export { historyCursor, mountNative };
