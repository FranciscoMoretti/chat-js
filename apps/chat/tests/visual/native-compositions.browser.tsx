import { createRef } from "react";
import { expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { takeSnapshot } from "@uiverify/vitest";
import { Hint } from "@/components/hint";
import { MenuButton } from "@/components/menu-button";
import { PopoverButton } from "@/components/popover-button";
import { ModelSelectionIndicator } from "@/components/model-selection-indicator";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent } from "@/components/ui/popover";
import { mount, unmount } from "./primitive-mount";
import "./sandbox.css";

test("native compositions preserve refs, activation and focus without extra buttons", async () => {
  const ref = createRef<HTMLButtonElement>();
  const activate = vi.fn<() => void>();
  const select = vi.fn<() => void>();
  const fixture = await mount(
    <TooltipProvider>
      <div className="flex min-h-80 items-start gap-4 p-12">
        <Hint
          trigger={
            <Button ref={ref} onClick={activate}>
              Save
            </Button>
          }
        >
          Save this conversation
        </Hint>
        <DropdownMenu>
          <MenuButton variant="outline">Actions</MenuButton>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={select}>Rename</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Popover>
          <PopoverButton variant="outline">Details</PopoverButton>
          <PopoverContent>Conversation details</PopoverContent>
        </Popover>
        <ModelSelectionIndicator selected />
        <ModelSelectionIndicator selected={false} />
      </div>
    </TooltipProvider>
  );
  try {
    const save = page.getByRole("button", { name: "Save", exact: true });
    expect(ref.current).toBe(save.element());
    expect(fixture.container.querySelector("button button")).toBeNull();
    await save.hover();
    await expect
      .element(
        page.getByText("Save this conversation", { exact: true }).first()
      )
      .toBeVisible();
    await takeSnapshot("native-compositions-hint");
    await save.click();
    expect(activate).toHaveBeenCalledOnce();

    const actions = page.getByRole("button", { name: "Actions", exact: true });
    await actions.click();
    await page.getByRole("menuitem", { name: "Rename", exact: true }).click();
    expect(select).toHaveBeenCalledOnce();
    await expect.element(actions).toHaveFocus();

    const details = page.getByRole("button", { name: "Details", exact: true });
    await details.click();
    await expect.element(page.getByText("Conversation details")).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await expect.element(details).toHaveFocus();
  } finally {
    await unmount(fixture);
  }
});
