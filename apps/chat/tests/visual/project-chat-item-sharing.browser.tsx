import { expect, test, vi } from "vitest";
import React, { act, useState } from "react";
import { page } from "vitest/browser";
import { takeSnapshot } from "@uiverify/vitest";
import { checkChatItemSharing } from "./chat-item-sharing.fixture";
import { ProjectChatItem } from "@/components/project-chat-item";
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
          projectId: "project",
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
