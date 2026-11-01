import { takeSnapshot } from "@uiverify/vitest";
import { SharingActions } from "@/chatjs/plugins/sharing/ui/chat-contributions";
import React, { act } from "react";
import { expect, vi } from "vitest";
import { page } from "vitest/browser";

import { ProjectChatItem } from "@/chatjs/plugins/projects/ui/project-chat-item";
import { SidebarChatItem } from "@/components/sidebar-chat-item";
import { DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { SidebarMenu } from "@/components/ui/sidebar";
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

vi.mock("@/chatjs/plugins/sharing/ui/share-dialog", () => ({
  EveShareButton: () => null,
  EveShareDialogContent: ({
    chatId,
    onClose,
  }: {
    chatId: string;
    onClose: () => void;
  }) => (
    <>
      <DialogTitle>Share conversation</DialogTitle>
      <DialogDescription>Share settings for {chatId}</DialogDescription>
      <button onClick={onClose} type="button">
        Close sharing
      </button>
    </>
  ),
}));

const checkChatItemSharing = async (
  chatId: "project-chat" | "sidebar-chat"
): Promise<void> => {
  const index = chatId === "project-chat" ? 0 : 1;
  const fixture = await mountNative(
    <div className="grid w-96 gap-8 p-8">
      <section>
        <h2>Project conversation</h2>
        <ProjectChatItem
          chat={{
            id: "project-chat",
            title: "Project notes",
          }}
          onRename={vi
            .fn<(id: string, title: string) => Promise<void>>()
            .mockResolvedValue()}
          pluginActions={
            <SharingActions
              chat={{
                id: chatId,
                title: "Notes",
                conversationId: chatId,
                state: "bound",
              }}
            />
          }
        />
      </section>
      <section>
        <h2>Sidebar conversation</h2>
        <SidebarMenu>
          <SidebarChatItem
            chat={{
              id: "sidebar-chat",
              isPinned: false,
              title: "Sidebar notes",
            }}
            isActive
            onPin={vi.fn<(id: string, pinned: boolean) => void>()}
            onRename={vi.fn<(id: string, title: string) => void>()}
            pluginActions={
              <SharingActions
                chat={{
                  id: chatId,
                  title: "Notes",
                  conversationId: chatId,
                  state: "bound",
                }}
              />
            }
            setOpenMobile={vi.fn<(open: boolean) => void>()}
          />
        </SidebarMenu>
      </section>
    </div>
  );
  try {
    await act(async () => {
      await page
        .getByRole("button", { exact: true, name: "More" })
        .nth(index)
        .click();
    });
    await act(async () => {
      await page.getByRole("menuitem", { exact: true, name: "Share" }).click();
    });
    await expect.element(page.getByRole("dialog")).toHaveTextContent(chatId);
    await takeSnapshot(`${chatId}-synchronous-share-content`);
    await page.getByRole("dialog").screenshot();
  } finally {
    await unmount(fixture.fixture);
    fixture.queryClient.clear();
  }
};

export { checkChatItemSharing };
