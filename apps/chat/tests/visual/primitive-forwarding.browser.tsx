import { Content as DropdownPrimitiveContent } from "@radix-ui/react-dropdown-menu";
import { takeSnapshot } from "@uiverify/vitest";
import React, { act, createRef } from "react";
import { expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";

import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

import { mount, unmount } from "./primitive-mount";

import "./sandbox.css";

test("menu portal groups and submenu preserve callbacks and refs", async () => {
  const portal = document.createElement("aside");
  document.body.append(portal);
  const navRef = createRef<HTMLElement>();
  const menuRef = createRef<HTMLButtonElement>();
  const selected: string[] = [];
  const opened: boolean[] = [];
  let navClicks = 0;
  const fixture = await mount(
    <>
      <Breadcrumb
        aria-label="Forwarded breadcrumb"
        data-contract="nav"
        ref={navRef}
        onClick={() => {
          navClicks += 1;
        }}
      >
        Branch navigation
      </Breadcrumb>
      <DropdownMenu
        onOpenChange={(value) => {
          opened.push(value);
        }}
      >
        <DropdownMenuTrigger asChild ref={menuRef}>
          <Button>Wrapper menu</Button>
        </DropdownMenuTrigger>
        <DropdownMenuPortal container={portal}>
          <DropdownPrimitiveContent aria-label="Forwarded menu">
            <DropdownMenuGroup>
              <DropdownMenuRadioGroup
                value="first"
                onValueChange={(value) => {
                  selected.push(value);
                }}
              >
                <DropdownMenuRadioItem value="first">
                  First choice
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="second">
                  Second choice
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Nested choices</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem
                    onSelect={() => {
                      selected.push("nested");
                    }}
                  >
                    Nested choice
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuGroup>
          </DropdownPrimitiveContent>
        </DropdownMenuPortal>
      </DropdownMenu>
    </>
  );
  try {
    expect(navRef.current?.dataset.contract).toBe("nav");
    expect(menuRef.current?.textContent).toBe("Wrapper menu");
    await act(async () => {
      await page
        .getByRole("navigation", { name: "Forwarded breadcrumb" })
        .click();
    });
    expect(navClicks).toBe(1);
    await act(async () => {
      await page.getByRole("button", { name: "Wrapper menu" }).click();
    });
    expect(portal.querySelector('[role="menu"]')).not.toBeNull();
    await act(async () => {
      await page.getByRole("menuitem", { name: "Nested choices" }).hover();
    });
    await expect
      .element(
        page.getByRole("menuitem", { exact: true, name: "Nested choice" })
      )
      .toBeVisible();
    await takeSnapshot("primitives-menu-submenu");
    await page.elementLocator(document.body).screenshot();
    await act(async () => {
      await page
        .getByRole("menuitem", { exact: true, name: "Nested choice" })
        .click();
    });
    await act(async () => {
      await page.getByRole("button", { name: "Wrapper menu" }).click();
    });
    await act(async () => {
      await page.getByRole("menuitemradio", { name: "Second choice" }).click();
    });
    expect(selected).toEqual(["nested", "second"]);
    expect(opened).toEqual([true, false, true, false]);
  } finally {
    await unmount(fixture);
    portal.remove();
  }
});

test("close callbacks hover content and separate popover anchor are forwarded", async () => {
  const dialogEvents: boolean[] = [];
  const sheetEvents: boolean[] = [];
  const children = (
    <>
      <Dialog
        onOpenChange={(open) => {
          dialogEvents.push(open);
        }}
      >
        <DialogTrigger asChild>
          <Button>Callback dialog</Button>
        </DialogTrigger>
        <DialogContent aria-describedby={undefined}>
          <DialogTitle>Callback dialog content</DialogTitle>
          <DialogClose asChild>
            <Button>Wrapper dialog close</Button>
          </DialogClose>
        </DialogContent>
      </Dialog>
      <Sheet
        onOpenChange={(open) => {
          sheetEvents.push(open);
        }}
      >
        <SheetTrigger asChild>
          <Button>Callback sheet</Button>
        </SheetTrigger>
        <SheetContent aria-describedby={undefined}>
          <SheetTitle>Callback sheet content</SheetTitle>
          <SheetClose asChild>
            <Button>Wrapper sheet close</Button>
          </SheetClose>
        </SheetContent>
      </Sheet>
      <HoverCard open>
        <HoverCardTrigger asChild>
          <Button>Hover anchor</Button>
        </HoverCardTrigger>
        <HoverCardContent>Forwarded hover content</HoverCardContent>
      </HoverCard>
      <Popover open>
        <PopoverAnchor asChild>
          <span
            className="mt-24 ml-64 block w-40"
            data-testid="separate-anchor"
          >
            Separate anchor
          </span>
        </PopoverAnchor>
        <PopoverContent>Separately anchored content</PopoverContent>
      </Popover>
    </>
  );
  let fixture = await mount(children);
  try {
    await act(async () => {
      await page
        .getByRole("button", { exact: true, name: "Callback dialog" })
        .click();
    });
    await act(async () => {
      await page.getByRole("button", { name: "Wrapper dialog close" }).click();
    });
    expect(dialogEvents).toEqual([true, false]);
    await unmount(fixture);
    fixture = await mount(children);
    await act(async () => {
      await page
        .getByRole("button", { exact: true, name: "Callback sheet" })
        .click();
    });
    await act(async () => {
      await page.getByRole("button", { name: "Wrapper sheet close" }).click();
    });
    expect(sheetEvents).toEqual([true, false]);
    await unmount(fixture);
    fixture = await mount(children);
    await expect
      .element(page.getByText("Forwarded hover content"))
      .toBeVisible();
    await expect
      .element(page.getByText("Separately anchored content"))
      .toBeVisible();
    const anchor = fixture.container.querySelector(
      '[data-testid="separate-anchor"]'
    );
    const content = document.querySelector('[data-slot="popover-content"]');
    expect(anchor).not.toBeNull();
    expect(content).not.toBeNull();
    await expect
      .poll(() => content?.getBoundingClientRect().top)
      .toBeGreaterThanOrEqual(anchor?.getBoundingClientRect().bottom ?? 0);
    await takeSnapshot("primitives-hover-separate-anchor");
    await act(async () => {
      await userEvent.keyboard("{Escape}");
    });
  } finally {
    await unmount(fixture);
  }
});
