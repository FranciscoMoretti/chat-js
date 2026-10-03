"use client";
/* oxlint-disable sort-imports -- Oxfmt owns this module's external, type-only, and alias import groups; its case-insensitive order conflicts with this declaration-order rule. */

import React from "react";

import { Button } from "@/components/ui/button";
import {
  ButtonGroup,
  ButtonGroupSeparator,
  ButtonGroupText,
} from "@/components/ui/button-group";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Toggle } from "@/components/ui/toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
/* oxlint-enable sort-imports */
/* oxlint-disable import/no-named-export, import/prefer-default-export, max-lines-per-function, react/forbid-component-props, react/jsx-max-depth, react/jsx-no-literals -- UiPrimitivesVisualFixture: import/no-named-export: existing callers import this public component, type, or hook by name; import/prefer-default-export: the existing named import remains stable when this module adds another public declaration; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/jsx-no-literals: these existing labels and accessible text are this feature content; localization is a separate content migration. */

export const UiPrimitivesVisualFixture = (): React.JSX.Element => (
  <main
    className="space-y-8 px-8 pt-8 pb-40"
    data-testid="ui-primitives-fixture"
  >
    <section className="max-w-3xl space-y-3">
      <h1>Button variants</h1>
      <div className="flex flex-wrap gap-3">
        <Button>Default</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="destructive">Destructive</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button asChild variant="link">
          <a href="#as-child">As child</a>
        </Button>
      </div>
    </section>

    <section className="max-w-3xl space-y-3">
      <h2>Input and toggle</h2>
      <div className="flex items-center gap-3">
        <Input aria-label="Fixture input" defaultValue="Fixture value" />
        <Toggle aria-label="Fixture toggle">Toggle</Toggle>
      </div>
    </section>

    <section className="max-w-3xl space-y-3">
      <h2>Button groups</h2>
      <ButtonGroup>
        <Button>Previous</Button>
        <ButtonGroupSeparator />
        <ButtonGroupText>Page 1 of 3</ButtonGroupText>
        <ButtonGroupSeparator />
        <Button>Next</Button>
      </ButtonGroup>
      <ButtonGroup orientation="vertical">
        <Button>Top</Button>
        <ButtonGroupSeparator orientation="horizontal" />
        <Button>Bottom</Button>
      </ButtonGroup>
    </section>

    <section className="grid max-w-3xl grid-cols-[auto_6rem_auto_auto_auto_auto] items-center gap-3">
      <span>Horizontal</span>
      <Separator className="!w-24 shrink-0" />
      <span>Vertical</span>
      <Separator className="!h-8 shrink-0" orientation="vertical" />
      <Popover>
        <PopoverTrigger asChild>
          <Button>Open popover</Button>
        </PopoverTrigger>
        <PopoverContent>Popover content</PopoverContent>
      </Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button>Hover tooltip</Button>
        </TooltipTrigger>
        <TooltipContent>Tooltip content</TooltipContent>
      </Tooltip>
    </section>
  </main>
);
/* oxlint-enable import/no-named-export, import/prefer-default-export, max-lines-per-function, react/forbid-component-props, react/jsx-max-depth, react/jsx-no-literals */
