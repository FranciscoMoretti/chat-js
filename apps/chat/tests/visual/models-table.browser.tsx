/* oxlint-disable sort-imports -- Keep runtime, type and fixture CSS imports grouped by module as required by Oxfmt. */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { takeSnapshot } from "@uiverify/vitest";
import React, { act } from "react";
import { expect, test, vi } from "vitest";
import { page } from "vitest/browser";

import { ModelsTable } from "@/components/settings/models-table";
import type { AppModelDefinition } from "@/lib/ai/app-models";
import { ChatModelsProvider } from "@/providers/chat-models-provider";
import { mount, unmount } from "@/tests/visual/primitive-mount";

import "@/tests/visual/sandbox.css";
/* oxlint-enable sort-imports */

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
          // oxlint-disable-next-line oxc/no-rest-spread-properties -- Forward the actual table's lifecycle callbacks unchanged into the native React Query mutation options.
          ...callbacks,
          mutationFn: save,
        }),
      },
    },
  }),
}));

/* oxlint-disable oxc/no-async-await -- Await native React commits, mutation settlement and browser capture in their actual order. */
/* oxlint-disable max-statements, max-lines-per-function -- Verify the full ordering lifetime, search and rollback seam in one native mounted table and one capture. */
test("table ordering survives toggles, rollback and search, then resets on remount", async () => {
  const firstRowIndex = 0;
  const pending = Promise.withResolvers<undefined>();
  save.mockReturnValue(pending.promise);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(queryKey, preferences);
  const renderTable = (search: string, key = "original"): React.JSX.Element => (
    <QueryClientProvider client={client}>
      <ChatModelsProvider models={models}>
        <ModelsTable key={key} search={search} />
      </ChatModelsProvider>
    </QueryClientProvider>
  );
  const fixture = await mount(renderTable(""));
  const rows = (): string[] =>
    Array.from(
      fixture.container.querySelectorAll("tr"),
      (row: { readonly textContent: string | null }) => row.textContent ?? ""
    );
  try {
    expect(rows()).toEqual(["Beta", "Alpha"]);
    await page.getByRole("switch").nth(firstRowIndex).click();
    await expect
      .poll(() => client.getQueryData(queryKey))
      .not.toEqual(preferences);
    expect(rows()).toEqual(["Beta", "Alpha"]);
    await act(async () => {
      await Promise.resolve();
      fixture.root.render(renderTable("alpha"));
    });
    expect(rows()).toEqual(["Alpha"]);
    await act(async () => {
      await Promise.resolve();
      fixture.root.render(renderTable(""));
    });
    expect(rows()).toEqual(["Beta", "Alpha"]);
    pending.reject(new Error("Controlled preference failure"));
    await expect.poll(() => client.getQueryData(queryKey)).toEqual(preferences);
    expect(rows()).toEqual(["Beta", "Alpha"]);
    await act(async () => {
      await Promise.resolve();
      client.setQueryData(queryKey, [
        { enabled: true, modelId: primary },
        { enabled: false, modelId: secondary },
      ]);
    });
    expect(rows()).toEqual(["Beta", "Alpha"]);
    await takeSnapshot("models-table-stable-order");
    await page.getByRole("table").screenshot();
    await act(async () => {
      await Promise.resolve();
      fixture.root.render(renderTable("", "remounted"));
    });
    expect(rows()).toEqual(["Alpha", "Beta"]);
  } finally {
    await unmount(fixture);
    client.clear();
  }
});
/* oxlint-enable max-statements, max-lines-per-function */
/* oxlint-enable oxc/no-async-await */
