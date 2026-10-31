import { expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { disableAutoSnapshot, takeSnapshot } from "@uiverify/vitest";
import { UserMessageView } from "@/components/user-message-view";
import {
  Context,
  ContextTrigger,
  ContextContent,
} from "@/components/ai-elements/context";
import { ShareMenuSurface } from "@/plugins/sharing/ui/share-menu-surface";
import { MoveMenuItem } from "@/plugins/projects/ui/move-menu-item";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { mount, unmount } from "./primitive-mount";
import "./sandbox.css";

test("native message surfaces retain editable, disabled and readonly DOM with immediate context hover", async () => {
  const onEdit = vi.fn<() => void>();
  const fixture = await mount(
    <div className="space-y-4 p-8">
      <UserMessageView text="Editable message" actions={null} onEdit={onEdit} />
      <UserMessageView
        text="Disabled message"
        actions={null}
        onEdit={onEdit}
        editDisabled
      />
      <UserMessageView text="Readonly message" actions={null} />
      <Context usedTokens={100} maxTokens={1000}>
        <ContextTrigger aria-label="Context usage" />
        <ContextContent>Context usage details</ContextContent>
      </Context>
    </div>
  );
  try {
    await page
      .getByRole("button", { name: "Editable message", exact: true })
      .click();
    expect(onEdit).toHaveBeenCalledOnce();
    const editable = page
      .getByRole("button", { name: "Editable message", exact: true })
      .element();
    if (!(editable instanceof HTMLElement)) {
      throw new Error("Missing editable bubble");
    }
    editable.focus();
    await userEvent.keyboard("{Enter}");
    expect(onEdit).toHaveBeenCalledTimes(2);
    await page
      .getByRole("button", { name: "Disabled message", exact: true })
      .click({ force: true });
    expect(onEdit).toHaveBeenCalledTimes(2);
    expect(
      page.getByText("Readonly message", { exact: true }).element()
        .parentElement?.tagName
    ).toBe("DIV");
    await page.getByRole("button", { name: "Context usage" }).hover();
    await expect.element(page.getByText("Context usage details")).toBeVisible();
    await takeSnapshot("native-feature-boundaries");
  } finally {
    await unmount(fixture);
  }
});

test.each(["pointer", "keyboard"] as const)(
  "native move and share menu actions activate once and keep their parent open (%s)",
  async (input) => {
    disableAutoSnapshot();
    const move = vi.fn<() => void>();
    const share = vi.fn<() => void>();
    const fixture = await mount(
      <DropdownMenu>
        <DropdownMenuTrigger type="button">Actions</DropdownMenuTrigger>
        <DropdownMenuContent>
          <MoveMenuItem onActivate={move}>Move</MoveMenuItem>
          <ShareMenuSurface authenticated onShare={share} />
        </DropdownMenuContent>
      </DropdownMenu>
    );
    try {
      await page.getByRole("button", { name: "Actions" }).click();
      // oxlint-disable eslint/no-await-in-loop -- Exercise sequential actions in the same open native menu.
      for (const name of ["Move", "Share"]) {
        const item = page.getByRole("menuitem", { name, exact: true });
        if (input === "pointer") {
          await item.click();
        } else {
          const element = item.element();
          if (!(element instanceof HTMLElement)) {
            throw new Error("Missing menu action");
          }
          element.focus();
          await userEvent.keyboard("{Enter}");
        }
        await expect.element(page.getByRole("menu")).toBeVisible();
      }
      // oxlint-enable eslint/no-await-in-loop
      expect(move).toHaveBeenCalledOnce();
      expect(share).toHaveBeenCalledOnce();
      await userEvent.keyboard("{Escape}");
      await expect
        .element(page.getByRole("button", { name: "Actions" }))
        .toHaveFocus();
    } finally {
      await unmount(fixture);
    }
  }
);

test("guest share opens its sign-in hint while retaining the parent menu", async () => {
  disableAutoSnapshot();
  const share = vi.fn<() => void>();
  const fixture = await mount(
    <DropdownMenu>
      <DropdownMenuTrigger type="button">Actions</DropdownMenuTrigger>
      <DropdownMenuContent>
        <ShareMenuSurface authenticated={false} onShare={share} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
  try {
    await page.getByRole("button", { name: "Actions" }).click();
    const item = page
      .getByRole("menuitem", { name: "Share", exact: true })
      .element();
    if (!(item instanceof HTMLElement)) {
      throw new Error("Missing share action");
    }
    item.focus();
    await userEvent.keyboard("{Enter}");
    await expect
      .element(page.getByText("Sign in to share your chats"))
      .toBeVisible();
    expect(share).not.toHaveBeenCalled();
  } finally {
    await unmount(fixture);
  }
});
