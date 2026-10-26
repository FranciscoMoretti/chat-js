import "./sandbox.css";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import React, { act, createContext, useContext } from "react";
import { expect, test, vi } from "vitest";
import { mount, unmount } from "./primitive-mount";
import { ShareMenuItem } from "@/plugins/sharing/ui/share-menu-item";
import { page, userEvent } from "vitest/browser";
import { takeSnapshot } from "@uiverify/vitest";

interface SessionFixture {
  readonly data: { readonly user: { readonly id: string } } | null;
}
const anonymousSession: SessionFixture = { data: null };
const authenticatedSession: SessionFixture = {
  data: { user: { id: "share-menu-fixture" } },
};
const SessionContext = createContext<SessionFixture>(anonymousSession);
vi.mock("@/providers/session-provider", () => ({
  useSession: (): SessionFixture => useContext(SessionContext),
}));

test("share menu preserves anonymous selection and authenticated sharing", async () => {
  const anonymousOpenChange = vi.fn<(open: boolean) => void>();
  const authenticatedOpenChange = vi.fn<(open: boolean) => void>();
  const onShare = vi.fn<() => void>();
  const fixture = await mount(
    <div className="flex gap-12 p-8">
      <SessionContext.Provider value={anonymousSession}>
        <DropdownMenu modal={false} onOpenChange={anonymousOpenChange} open>
          <DropdownMenuTrigger>Anonymous menu</DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuGroup>
              <ShareMenuItem onShare={onShare} />
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SessionContext.Provider>
      <SessionContext.Provider value={authenticatedSession}>
        <DropdownMenu modal={false} onOpenChange={authenticatedOpenChange} open>
          <DropdownMenuTrigger>Authenticated menu</DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuGroup>
              <ShareMenuItem onShare={onShare}>
                <span>Public link</span>
              </ShareMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SessionContext.Provider>
    </div>
  );
  try {
    const anonymousItem = page.getByRole("menuitem", {
      exact: true,
      name: "Share",
    });
    const authenticatedItem = page.getByRole("menuitem", {
      name: "Share Public link",
    });
    await expect.element(anonymousItem).toBeVisible();
    await expect.element(authenticatedItem).toBeVisible();
    anonymousOpenChange.mockClear();
    await act(async () => {
      await anonymousItem.click();
      await expect
        .element(page.getByText("Sign in to share your chats"))
        .toBeVisible();
    });
    expect(anonymousOpenChange.mock.calls.some(([open]) => !open)).toBe(false);
    expect(onShare).not.toHaveBeenCalled();
    await act(async () => {
      await Promise.all(
        document
          .getAnimations()
          .map(
            async (
              animation: Readonly<Pick<Animation, "finished">>
            ): Promise<void> => {
              await animation.finished;
            }
          )
      );
      await takeSnapshot("share-menu-session-branches");
      await page.screenshot({
        path: "__screenshots__/share-menu-session-branches.png",
      });
    });
  } finally {
    await unmount(fixture);
  }
});

test("authenticated sharing keeps its menu mounted for the dialog", async () => {
  const onOpenChange = vi.fn<(open: boolean) => void>();
  const onShare = vi.fn<() => void>();
  const fixture = await mount(
    <SessionContext.Provider value={authenticatedSession}>
      <DropdownMenu defaultOpen onOpenChange={onOpenChange}>
        <DropdownMenuTrigger>Authenticated menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuGroup>
            <ShareMenuItem onShare={onShare} />
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </SessionContext.Provider>
  );
  try {
    const item = page.getByRole("menuitem", { name: "Share", exact: true });
    await expect.element(item).toBeVisible();
    onOpenChange.mockClear();
    await act(async () => {
      await item.click();
    });
    expect(onShare).toHaveBeenCalledExactlyOnceWith();
    expect(onOpenChange.mock.calls.some(([open]) => !open)).toBe(false);
    await expect.element(item).toBeVisible();
    await act(async () => {
      const menuItem = item.element();
      if (!(menuItem instanceof HTMLElement)) {
        throw new Error("Expected menu item");
      }
      menuItem.focus();
      await userEvent.keyboard("{Enter}");
    });
    expect(onShare).toHaveBeenCalledTimes(2);
    expect(onOpenChange.mock.calls.some(([open]) => !open)).toBe(false);
  } finally {
    await unmount(fixture);
  }
});
