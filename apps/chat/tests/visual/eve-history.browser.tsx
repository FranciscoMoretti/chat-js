import { takeSnapshot } from "@uiverify/vitest";
import React, { act } from "react";
import { expect, test } from "vitest";
import { page } from "vitest/browser";

import { EveHistoryList } from "@/components/eve/eve-history-list";
import type { listEveConversations } from "@/lib/db/eve-queries";
import { historyCursor, mountNative } from "@/tests/visual/native-eve-fixture";
import { unmount } from "@/tests/visual/primitive-mount";

type EveHistoryPage = Awaited<ReturnType<typeof listEveConversations>>;
const initialPages: readonly {
  readonly name: "next" | "refetch";
  readonly next: boolean;
  readonly page: EveHistoryPage;
}[] = [
  {
    name: "refetch",
    next: false,
    page: {
      items: [],
      nextCursor: null,
    },
  },
  { name: "next", next: true, page: { items: [], nextCursor: historyCursor } },
];
const loadNextPage = async (): Promise<void> => {
  await expect
    .element(
      page.getByRole("button", { exact: true, name: "Load more conversations" })
    )
    .toBeVisible();
  await act(async () => {
    await page
      .getByRole("button", { exact: true, name: "Load more conversations" })
      .click();
  });
};
const retryHistoryFailure = async (
  name: string,
  historyInputs: readonly unknown[]
): Promise<void> => {
  await expect
    .element(page.getByRole("button", { exact: true, name: "Retry" }))
    .toBeVisible();
  const failedInput = historyInputs.at(-1);
  const count = historyInputs.length;
  await takeSnapshot(`history-${name}-failure`);
  await act(async () => {
    await page.getByRole("button", { exact: true, name: "Retry" }).click();
  });
  await expect.poll(() => historyInputs.length).toBe(count + 1);
  expect(historyInputs.at(-1)).toEqual(failedInput);
  await expect
    .element(page.getByRole("button", { exact: true, name: "Retry" }))
    .toBeVisible();
  await takeSnapshot(`history-${name}-retried`);
};
for (const mode of initialPages) {
  test(`native history retry ${mode.name}`, async () => {
    const state = await mountNative(
      <EveHistoryList ownerId="fixture-user" initialPage={mode.page} />,
      mode.name
    );
    try {
      if (mode.next) {
        await loadNextPage();
      }
      await retryHistoryFailure(mode.name, state.historyInputs);
    } finally {
      await unmount(state.fixture);
      state.queryClient.clear();
    }
  });
}
