/* oxlint-disable import/max-dependencies -- This integration fixture mounts the actual Next, query, tRPC, session and catalog providers and uses their native test and type APIs. */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TRPCClientError, createTRPCClient } from "@trpc/client";
// oxlint-disable-next-line sort-imports -- Oxfmt places @tanstack before @trpc and retains this separate type declaration; that module grouping conflicts with local-binding name order.
import type { OperationResultObserver, TRPCLink } from "@trpc/client";
import { observable } from "@trpc/server/observable";
import { takeSnapshot } from "@uiverify/vitest";
// oxlint-disable-next-line sort-imports -- Oxfmt groups imports by module and retains separate type declarations; its header order conflicts with sort-imports local-binding syntax order.
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
// oxlint-disable-next-line sort-imports -- Oxfmt groups imports by module and retains separate type declarations; its header order conflicts with sort-imports local-binding syntax order.
import React, { act, useState } from "react";
import { expect, test, vi } from "vitest";
// oxlint-disable-next-line sort-imports -- Oxfmt groups imports by module and retains separate type declarations; its header order conflicts with sort-imports local-binding syntax order.
import { commands, page } from "vitest/browser";

import { ModelSelector } from "@/components/model-selector";
// oxlint-disable-next-line sort-imports -- Oxfmt groups imports by module and retains separate type declarations; its header order conflicts with sort-imports local-binding syntax order.
import type { AppModelDefinition } from "@/lib/ai/app-models";
import type { SelectedModelValue } from "@/lib/ai/types";
import type { Session } from "@/lib/auth";
// oxlint-disable-next-line sort-imports -- Oxfmt groups imports by module and retains separate type declarations; its header order conflicts with sort-imports local-binding syntax order.
import { ChatModelsProvider } from "@/providers/chat-models-provider";
import { SessionProvider } from "@/providers/session-provider";
// oxlint-disable-next-line sort-imports -- Oxfmt groups imports by module and retains separate type declarations; its header order conflicts with sort-imports local-binding syntax order.
import { mount, unmount } from "@/tests/visual/primitive-mount";
import { TRPCProvider } from "@/trpc/react";
// oxlint-disable-next-line sort-imports -- Oxfmt groups imports by module and retains separate type declarations; its header order conflicts with sort-imports local-binding syntax order.
import type { AppRouter } from "@/trpc/routers/_app";

// oxlint-disable-next-line sort-imports -- Oxfmt groups imports by module and retains separate type declarations; its header order conflicts with sort-imports local-binding syntax order.
import "@/tests/visual/sandbox.css";

/* oxlint-enable import/max-dependencies */
declare module "vitest/browser" {
  interface BrowserCommands {
    modelAssets: () => Promise<void>;
  }
}
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
/* oxlint-disable react/only-export-components -- This browser-test entrypoint mounts its local stateful controller; exporting a test-only component would create an unused API. */
const Controller = ({
  initialSelection,
}: {
  readonly initialSelection: SelectedModelValue;
}): React.JSX.Element => {
  const [selection, setSelection] =
    useState<SelectedModelValue>(initialSelection);
  return (
    <section>
      <output data-testid="selection">{JSON.stringify(selection)}</output>
      <ModelSelector
        selectedModelId="openai/gpt-4.1"
        selectedModelSelection={selection}
        onModelSelectionChangeAction={setSelection}
      />
    </section>
  );
};
/* oxlint-enable react/only-export-components */
const scenarios: {
  readonly name: string;
  readonly initialSelection: SelectedModelValue;
  readonly expectedSelection: string;
}[] = [
  {
    expectedSelection: '"google/gemini-2.5-flash"',
    initialSelection: "openai/gpt-4.1",
    name: "single",
  },
  {
    expectedSelection: '{"openai/gpt-4.1":1,"google/gemini-2.5-flash":1}',
    initialSelection: { "openai/gpt-4.1": 1 },
    name: "multiple",
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
const createPreferencesClient = (): {
  readonly client: ReturnType<typeof createTRPCClient<AppRouter>>;
  readonly requests: readonly string[];
} => {
  const requests: string[] = [];
  const client = createTRPCClient<AppRouter>({
    links: [
      (): ReturnType<TRPCLink<AppRouter>> =>
        ({
          op,
        }: {
          readonly op: { readonly path: string };
        }): ReturnType<ReturnType<TRPCLink<AppRouter>>> =>
          observable(
            (
              observer: Readonly<OperationResultObserver<AppRouter, unknown>>
            ): void => {
              requests.push(op.path);
              if (op.path !== "settings.getModelPreferences") {
                observer.error(
                  TRPCClientError.from(
                    new Error(`Unhandled fixture procedure ${op.path}`)
                  )
                );
                return;
              }
              observer.next({
                result: {
                  data: models.map(
                    (model: { readonly id: AppModelDefinition["id"] }) => ({
                      enabled: true,
                      modelId: model.id,
                    })
                  ),
                },
              });
              observer.complete();
            }
          ),
    ],
  });

  return { client, requests };
};
/* oxlint-disable oxc/no-async-await -- Await the native-provider mount before interactions use the portal and query state. */
const mountSelector = async (
  initialSelection: Readonly<SelectedModelValue>
): Promise<{
  readonly fixture: Awaited<ReturnType<typeof mount>>;
  readonly queryClient: QueryClient;
  readonly requests: readonly string[];
}> => {
  const { client, requests } = createPreferencesClient();
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  /* oxlint-disable react/jsx-max-depth -- The actual Next router, QueryClient, tRPC, session and catalog providers must wrap this component in their native order. */
  const fixture = await mount(
    <AppRouterContext.Provider value={router}>
      <QueryClientProvider client={queryClient}>
        <TRPCProvider trpcClient={client} queryClient={queryClient}>
          <SessionProvider>
            <ChatModelsProvider models={models}>
              <Controller initialSelection={initialSelection} />
            </ChatModelsProvider>
          </SessionProvider>
        </TRPCProvider>
      </QueryClientProvider>
    </AppRouterContext.Provider>
  );
  /* oxlint-enable react/jsx-max-depth */
  return { fixture, queryClient, requests };
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Await actual portal visibility, capture and selection before checking the state contract. */
const selectBeta = async (name: string): Promise<void> => {
  await expect.element(page.getByTestId("model-selector")).toBeVisible();
  await act(async () => {
    await page.getByTestId("model-selector").click();
  });
  await expect
    .element(page.getByRole("option", { name: /Fixture Beta/u }))
    .toBeVisible();
  await takeSnapshot(`model-native-${name}-before`);
  await page.elementLocator(document.body).screenshot();
  await act(async () => {
    await page.getByRole("option", { name: /Fixture Beta/u }).click();
  });
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Await the real selection result, state capture and guaranteed fixture cleanup. */
for (const scenario of scenarios) {
  test(`native model selection ${scenario.name}`, async () => {
    await commands.modelAssets();

    const { fixture, queryClient, requests } = await mountSelector(
      scenario.initialSelection
    );
    try {
      await selectBeta(scenario.name);
      await expect
        .poll(() => page.getByTestId("selection").element().textContent)
        .toBe(scenario.expectedSelection);
      expect(requests).toContain("settings.getModelPreferences");
      await takeSnapshot(`model-native-${scenario.name}-after`);
    } finally {
      await unmount(fixture);
      queryClient.clear();
    }
  });
}

/* oxlint-enable oxc/no-async-await */
