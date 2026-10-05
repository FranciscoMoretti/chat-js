import { Content as DropdownPrimitiveContent } from "@radix-ui/react-dropdown-menu";
import { takeSnapshot } from "@uiverify/vitest";
/* oxlint-disable eslint/sort-imports -- eslint/sort-imports: Preserve existing runtime module evaluation order and pinned Oxfmt declaration ordering. */
import React, { act, createRef } from "react";
/* oxlint-enable eslint/sort-imports */
import { expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";

import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
/* oxlint-disable eslint/sort-imports -- eslint/sort-imports: Preserve existing runtime module evaluation order and pinned Oxfmt declaration ordering. */
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
/* oxlint-enable eslint/sort-imports */
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
/* oxlint-disable import/max-dependencies -- This integration fixture checks composed forwarding across the menu, dialog, sheet, hover and anchor APIs. */
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
/* oxlint-enable import/max-dependencies */
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

/* oxlint-disable eslint/sort-imports -- eslint/sort-imports: Preserve existing runtime module evaluation order and pinned Oxfmt declaration ordering. */
import { mount, unmount } from "./primitive-mount";

import "./sandbox.css";
/* oxlint-enable eslint/sort-imports */

/* oxlint-disable eslint/max-statements, eslint/max-lines-per-function, oxc/no-async-await, react/jsx-no-literals, react-perf/jsx-no-new-function-as-prop, eslint/no-magic-numbers, react/jsx-max-depth, typescript/promise-function-async -- eslint/max-statements: Keep this ordered browser interaction and its cleanup in one observable scenario; eslint/max-lines-per-function: Keep the composed Radix hierarchy and its interaction assertions together; oxc/no-async-await: Browser lifecycle and interactions await React commits before captures and cleanup; react/jsx-no-literals: Fixed accessible fixture labels make overlay captures and interaction targets deterministic; react-perf/jsx-no-new-function-as-prop: Fixture callbacks record caller events and do not drive a production rendering loop; eslint/no-magic-numbers: Assertions check exactly one forwarded click and zero fallback geometry for a missing DOM node; react/jsx-max-depth: Radix portal, group and asChild nesting is the actual forwarding contract under test; typescript/promise-function-async: Return the browser interaction promise directly to React act without another async wrapper. */
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
    await act(() =>
      page.getByRole("navigation", { name: "Forwarded breadcrumb" }).click()
    );
    expect(navClicks).toBe(1);
    await act(() => page.getByRole("button", { name: "Wrapper menu" }).click());
    expect(portal.querySelector('[role="menu"]')).not.toBeNull();
    await act(() =>
      page.getByRole("menuitem", { name: "Nested choices" }).hover()
    );
    await expect
      .element(
        page.getByRole("menuitem", { exact: true, name: "Nested choice" })
      )
      .toBeVisible();
    await takeSnapshot("primitives-menu-submenu");
    await act(() =>
      page.getByRole("menuitem", { exact: true, name: "Nested choice" }).click()
    );
    await act(() => page.getByRole("button", { name: "Wrapper menu" }).click());
    await act(() =>
      page.getByRole("menuitemradio", { name: "Second choice" }).click()
    );
    expect(selected).toEqual(["nested", "second"]);
    expect(opened).toEqual([true, false, true, false]);
  } finally {
    await unmount(fixture);
    portal.remove();
  }
});
/* oxlint-enable eslint/max-statements, eslint/max-lines-per-function, oxc/no-async-await, react/jsx-no-literals, react-perf/jsx-no-new-function-as-prop, eslint/no-magic-numbers, react/jsx-max-depth, typescript/promise-function-async */
/* oxlint-disable eslint/max-statements, eslint/max-lines-per-function, oxc/no-async-await, react/jsx-no-literals, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, eslint/no-undefined, eslint/no-magic-numbers, typescript/promise-function-async -- eslint/max-statements: Keep this ordered browser interaction and its cleanup in one observable scenario; eslint/max-lines-per-function: Keep the composed Radix hierarchy and its interaction assertions together; oxc/no-async-await: Browser lifecycle and interactions await React commits before captures and cleanup; react/jsx-no-literals: Fixed accessible fixture labels make overlay captures and interaction targets deterministic; react-perf/jsx-no-new-function-as-prop: Fixture callbacks record caller events and do not drive a production rendering loop; react/jsx-max-depth: Radix portal, group and asChild nesting is the actual forwarding contract under test; eslint/no-undefined: Radix explicitly accepts undefined aria-describedby to omit optional descriptions in this heading-only fixture; eslint/no-magic-numbers: Assertions check exactly one forwarded click and zero fallback geometry for a missing DOM node; typescript/promise-function-async: Return the browser interaction promise directly to React act without another async wrapper. */
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
    await act(() =>
      page.getByRole("button", { exact: true, name: "Callback dialog" }).click()
    );
    await act(() =>
      page.getByRole("button", { name: "Wrapper dialog close" }).click()
    );
    expect(dialogEvents).toEqual([true, false]);
    await unmount(fixture);
    fixture = await mount(children);
    await act(() =>
      page.getByRole("button", { exact: true, name: "Callback sheet" }).click()
    );
    await act(() =>
      page.getByRole("button", { name: "Wrapper sheet close" }).click()
    );
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
    await act(() => userEvent.keyboard("{Escape}"));
  } finally {
    await unmount(fixture);
  }
});
/* oxlint-enable eslint/max-statements, eslint/max-lines-per-function, oxc/no-async-await, react/jsx-no-literals, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, eslint/no-undefined, eslint/no-magic-numbers, typescript/promise-function-async */
