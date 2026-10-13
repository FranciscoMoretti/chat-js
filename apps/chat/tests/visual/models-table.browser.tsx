import {
  QueryClient,
  QueryClientProvider,
  notifyManager,
} from "@tanstack/react-query";
import { takeSnapshot } from "@uiverify/vitest";
import React, { act } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { page } from "vitest/browser";

import { ModelsTable } from "@/components/settings/models-table";
import type { AppModelDefinition } from "@/lib/ai/app-models";
import { ChatModelsProvider } from "@/providers/chat-models-provider";
import { mount, renderRoot, unmount } from "@/tests/visual/primitive-mount";

import "@/tests/visual/sandbox.css";

beforeEach(() => {
  notifyManager.setNotifyFunction((notify) => {
    act(notify);
  });
});
afterEach(() => {
  notifyManager.setNotifyFunction((notify) => {
    notify();
  });
});

const primary = "openai/gpt-4.1";
const secondary = "google/gemini-2.5-flash";
const queryKey = ["model-preferences"];
const preferences = [
  { enabled: false, modelId: primary },
  { enabled: true, modelId: secondary },
];
const createModel = (
  id: AppModelDefinition["id"],
  name: string
): AppModelDefinition => ({
  apiModelId: id,
  context_window: 128_000,
  description: name,
  id,
  input: { audio: false, image: false, pdf: false, text: true, video: false },
  max_tokens: 16_384,
  name,
  object: "model",
  output: { audio: false, image: false, text: true, video: false },
  owned_by: "fixture",
  pricing: {},
  reasoning: false,
  toolCall: false,
  type: "language",
});
const models = [createModel(primary, "Alpha"), createModel(secondary, "Beta")];
const save =
  vi.fn<
    (input: {
      readonly modelId: string;
      readonly enabled: boolean;
    }) => Promise<void>
  >();
vi.mock("@/lib/ai/app-models", () => ({
  getDefaultEnabledModels: (): Set<string> => new Set([primary]),
}));
vi.mock("@/providers/session-provider", () => ({
  useSession: (): object => ({ data: { user: { id: "fixture" } } }),
}));
vi.mock("@/trpc/react", () => ({
  useTRPC: (): object => ({
    settings: {
      getModelPreferences: {
        queryKey: (): string[] => queryKey,
        queryOptions: (): object => ({
          queryFn: (): typeof preferences => preferences,
          queryKey,
          staleTime: Infinity,
        }),
      },
      setModelEnabled: {
        mutationOptions: (
          callbacks: Readonly<Record<string, unknown>>
        ): object => ({
          ...callbacks,
          mutationFn: save,
        }),
      },
    },
  }),
}));

test("table ordering survives toggles, rollback and search, then resets on remount", async () => {
  const firstRowIndex = 0;
  const pending = Promise.withResolvers<undefined>();
  save.mockReturnValue(pending.promise);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(queryKey, preferences);
  const renderTable = (search: string, key = "original"): React.JSX.Element => (
    <React.StrictMode>
      <QueryClientProvider client={client}>
        <ChatModelsProvider models={models}>
          <ModelsTable key={key} search={search} />
        </ChatModelsProvider>
      </QueryClientProvider>
    </React.StrictMode>
  );
  const fixture = await mount(renderTable(""));
  const rows = (): string[] =>
    Array.from(
      fixture.container.querySelectorAll("tr"),
      (row: { readonly textContent: string | null }) => row.textContent ?? ""
    );
  try {
    expect(rows()).toEqual(["Beta", "Alpha"]);
    await act(async () => {
      await page.getByRole("switch").nth(firstRowIndex).click();
    });
    await expect
      .poll(() => client.getQueryData(queryKey))
      .not.toEqual(preferences);
    expect(rows()).toEqual(["Beta", "Alpha"]);
    await renderRoot(fixture.root, renderTable("alpha"));
    expect(rows()).toEqual(["Alpha"]);
    await renderRoot(fixture.root, renderTable(""));
    expect(rows()).toEqual(["Beta", "Alpha"]);
    pending.reject(new Error("Controlled preference failure"));
    await expect.poll(() => client.getQueryData(queryKey)).toEqual(preferences);
    expect(rows()).toEqual(["Beta", "Alpha"]);
    act(() => {
      client.setQueryData(queryKey, [
        { enabled: true, modelId: primary },
        { enabled: false, modelId: secondary },
      ]);
    });
    await expect.element(page.getByRole("switch").nth(0)).not.toBeChecked();
    await expect.element(page.getByRole("switch").nth(1)).toBeChecked();
    expect(rows()).toEqual(["Beta", "Alpha"]);
    await takeSnapshot("models-table-stable-order");
    await Promise.all(
      document
        .getAnimations()
        .map(async (animation) => await animation.finished)
    );
    await page.getByRole("table").screenshot();
    await renderRoot(fixture.root, renderTable("", "remounted"));
    expect(rows()).toEqual(["Alpha", "Beta"]);
  } finally {
    await unmount(fixture);
    client.clear();
  }
});

test("catalog refreshes preserve surviving row order and keep table instances isolated", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(queryKey, preferences);
  const third = createModel("fixture/third", "Gamma");
  const [alpha, beta] = models;
  const renderTables = (
    catalog: readonly AppModelDefinition[]
  ): React.JSX.Element => (
    <React.StrictMode>
      <QueryClientProvider client={client}>
        <ChatModelsProvider models={catalog}>
          <section aria-label="Refreshed table">
            <ModelsTable search="" />
          </section>
        </ChatModelsProvider>
        <ChatModelsProvider models={[third, alpha]}>
          <section aria-label="Independent table">
            <ModelsTable search="" />
          </section>
        </ChatModelsProvider>
      </QueryClientProvider>
    </React.StrictMode>
  );
  const fixture = await mount(renderTables(models));
  const rows = (label: string): string[] =>
    Array.from(
      fixture.container.querySelectorAll(`section[aria-label="${label}"] tr`),
      (row) => row.textContent ?? ""
    );
  try {
    expect(rows("Refreshed table")).toEqual(["Beta", "Alpha"]);
    expect(rows("Independent table")).toEqual(["Gamma", "Alpha"]);
    await renderRoot(fixture.root, renderTables([third, alpha, beta]));
    expect(rows("Refreshed table")).toEqual(["Beta", "Alpha", "Gamma"]);
    await renderRoot(fixture.root, renderTables([third, alpha]));
    expect(rows("Refreshed table")).toEqual(["Alpha", "Gamma"]);
    await renderRoot(fixture.root, renderTables([beta, third, alpha]));
    expect(rows("Refreshed table")).toEqual(["Alpha", "Gamma", "Beta"]);
    expect(rows("Independent table")).toEqual(["Gamma", "Alpha"]);
    await takeSnapshot("models-table-refreshed-catalog");
    await page.screenshot();
    await renderRoot(fixture.root, renderTables([]));
    expect(rows("Refreshed table")).toEqual([]);
    await expect.element(page.getByText("No models found.")).toBeVisible();
  } finally {
    await unmount(fixture);
    client.clear();
  }
});
