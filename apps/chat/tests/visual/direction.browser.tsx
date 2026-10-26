import { act } from "react";
import { takeSnapshot } from "@uiverify/vitest";
import { expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { DirectionProvider } from "@/components/ui/direction";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { mount, unmount } from "./primitive-mount";
import "./sandbox.css";

for (const direction of ["ltr", "rtl"] as const) {
  test(`native ${direction} menus follow reading direction and keyboard navigation`, async () => {
    const previousDirection = document.documentElement.dir;
    document.documentElement.dir = direction;
    const fixture = await mount(
      <DirectionProvider direction={direction}>
        <div className="flex min-h-80 items-start justify-center p-12">
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" />}>
              Menu
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>More options</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem>Nested action</DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem>Other action</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </DirectionProvider>
    );
    try {
      await act(async () => {
        await page.getByRole("button", { name: "Menu", exact: true }).click();
      });
      const submenu = page.getByRole("menuitem", { name: "More options" });
      act(() => {
        submenu.element().focus();
      });
      await act(async () => {
        await userEvent.keyboard(
          direction === "rtl" ? "{ArrowLeft}" : "{ArrowRight}"
        );
      });
      await expect
        .element(page.getByRole("menuitem", { name: "Nested action" }))
        .toBeVisible();
      await takeSnapshot(`direction-${direction}-submenu`);
      await act(async () => {
        await userEvent.keyboard(
          direction === "rtl" ? "{ArrowRight}" : "{ArrowLeft}"
        );
      });
      await expect.element(submenu).toHaveFocus();
      await expect
        .element(page.getByRole("menuitem", { name: "Nested action" }))
        .not.toBeInTheDocument();
    } finally {
      await unmount(fixture);
      document.documentElement.dir = previousDirection;
    }
  });
}
