import { expect, test, vi } from "vitest";
import React, { act, useState } from "react";
import { page } from "vitest/browser";
import { takeSnapshot } from "@uiverify/vitest";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { checkChatItemSharing } from "./chat-item-sharing.fixture";
import { ProjectChatItem } from "@/plugins/projects/ui/project-chat-item";
import { mountNative } from "@/tests/visual/native-eve-fixture";
import { unmount } from "@/tests/visual/primitive-mount";

vi.mock("@/providers/session-provider", () => ({
  SessionProvider: ({ children }: { readonly children: React.JSX.Element }) =>
    children,
  useSession: () => ({
    data: { user: { id: "fixture-user" } },
    isPending: false,
  }),
}));

test("project item renders synchronous share content", async () => {
  const clock = vi
    .spyOn(Date, "now")
    .mockReturnValue(Date.parse("2026-09-25T10:00:00Z"));
  try {
    await checkChatItemSharing("project-chat");
  } finally {
    clock.mockRestore();
  }
});

const UpdatingProject = (): React.JSX.Element => {
  const [updatedAt, setUpdatedAt] = useState("2026-09-25T09:55:00Z");
  return (
    <>
      <ProjectChatItem
        chat={{
          id: "clock-chat",
          title: "Clock conversation",
          updatedAt,
        }}
        onRename={vi
          .fn<(id: string, title: string) => Promise<void>>()
          .mockResolvedValue()}
        renderShareContent={() => null}
      />
      <button
        type="button"
        onClick={() => {
          setUpdatedAt("2026-09-25T10:06:00Z");
        }}
      >
        Receive message
      </button>
    </>
  );
};

const hydrationRouter = {
  back: vi.fn<() => void>(),
  bfcacheId: "project-hydration",
  forward: vi.fn<() => void>(),
  prefetch: vi.fn<() => void>(),
  push: vi.fn<() => void>(),
  refresh: vi.fn<() => void>(),
  replace: vi.fn<() => void>(),
};

test("project age hydrates without errors when the browser clock differs", async () => {
  const clock = vi
    .spyOn(Date, "now")
    .mockReturnValue(Date.parse("2026-09-25T10:00:00Z"));
  const container = document.createElement("div");
  document.body.append(container);
  const recoverableError = vi.fn<(error: unknown) => void>();
  const tree = (
    <AppRouterContext.Provider value={hydrationRouter}>
      <UpdatingProject />
    </AppRouterContext.Provider>
  );
  let root: ReturnType<typeof hydrateRoot> | undefined;
  try {
    container.innerHTML = renderToString(tree);
    expect(container.textContent).toContain("Clock conversation");
    expect(container.textContent).not.toContain("ago");
    clock.mockReturnValue(Date.parse("2026-09-25T10:05:00Z"));
    act(() => {
      root = hydrateRoot(container, tree, {
        onRecoverableError: recoverableError,
      });
    });
    await expect
      .element(page.getByText("10 minutes ago", { exact: true }))
      .toBeVisible();
    expect(recoverableError).not.toHaveBeenCalled();
  } finally {
    act(() => {
      root?.unmount();
    });
    container.remove();
    clock.mockRestore();
  }
});

test("project age advances and handles a later message", async () => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  const clock = vi
    .spyOn(Date, "now")
    .mockReturnValue(Date.parse("2026-09-25T10:00:00Z"));
  const fixture = await mountNative(<UpdatingProject />);
  try {
    await expect
      .element(page.getByText("5 minutes ago", { exact: true }))
      .toBeVisible();
    await takeSnapshot("project-chat-item-relative-age");
    clock.mockReturnValue(Date.parse("2026-09-25T10:05:00Z"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    await expect
      .element(page.getByText("10 minutes ago", { exact: true }))
      .toBeVisible();
    clock.mockReturnValue(Date.parse("2026-09-25T10:06:00Z"));
    await act(async () => {
      await page.getByRole("button", { name: "Receive message" }).click();
    });
    await expect
      .element(page.getByText("less than a minute ago", { exact: true }))
      .toBeVisible();
  } finally {
    await unmount(fixture.fixture);
    expect(vi.getTimerCount()).toBe(0);
    fixture.queryClient.clear();
    clock.mockRestore();
    vi.useRealTimers();
  }
});
