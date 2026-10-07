import { takeSnapshot } from "@uiverify/vitest";
/* oxlint-disable sort-imports -- Pinned Oxfmt groups imports by module, while sort-imports requires a different binding-name or binding-syntax order. */
import React, { act } from "react";
/* oxlint-enable sort-imports */
import { expect, test } from "vitest";
import { page } from "vitest/browser";

/* oxlint-disable sort-imports -- Pinned Oxfmt groups imports by module, while sort-imports requires a different binding-name or binding-syntax order. */
import { EveHistoryList } from "@/components/eve/eve-history-list";
/* oxlint-enable sort-imports */
import type { listEveConversations } from "@/lib/db/eve-queries";
/* oxlint-disable sort-imports -- Pinned Oxfmt groups imports by module, while sort-imports requires a different binding-name or binding-syntax order. */
import { historyCursor, mountNative } from "@/tests/visual/native-eve-fixture";
/* oxlint-enable sort-imports */
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
      items:
        [] /* oxlint-disable unicorn/no-null -- The actual Eve page cursor uses null to mark the end of the first-page fixture. */,
      nextCursor: null,
      /* oxlint-enable unicorn/no-null */
    },
  },
  { name: "next", next: true, page: { items: [], nextCursor: historyCursor } },
];
/* oxlint-disable oxc/no-async-await -- Await native query, React and browser lifecycle completion before state assertions, captures and cleanup. */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Await native query, React and browser lifecycle completion before state assertions, captures and cleanup. */
const retryHistoryFailure = async (
  name: string,
  historyInputs: readonly unknown[]
): Promise<void> => {
  await expect
    .element(page.getByRole("button", { exact: true, name: "Retry" }))
    .toBeVisible();
  const /* oxlint-disable eslint/no-magic-numbers -- Read the last actual request so retry must preserve the failed page’s complete cursor input. */
    failedInput = historyInputs.at(-1);
  /* oxlint-enable eslint/no-magic-numbers */
  const count = historyInputs.length;
  await takeSnapshot(`history-${name}-failure`);
  await act(async () => {
    await page.getByRole("button", { exact: true, name: "Retry" }).click();
  });
  /* oxlint-disable eslint/no-magic-numbers -- One Retry click must dispatch exactly one further native request. */
  await expect.poll(() => historyInputs.length).toBe(count + 1);
  /* oxlint-enable eslint/no-magic-numbers */
  /* oxlint-disable eslint/no-magic-numbers -- Read the last actual request so retry must preserve the failed page’s complete cursor input. */
  expect(historyInputs.at(-1))
    /* oxlint-enable eslint/no-magic-numbers */ .toEqual(failedInput);
  await expect
    .element(page.getByRole("button", { exact: true, name: "Retry" }))
    .toBeVisible();
  await takeSnapshot(`history-${name}-retried`);
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Await native query, React and browser lifecycle completion before state assertions, captures and cleanup. */
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
/* oxlint-enable oxc/no-async-await */
