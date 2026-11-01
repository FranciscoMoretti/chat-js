"use client";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  ButtonGroup,
  ButtonGroupSeparator,
  ButtonGroupText,
} from "@/components/ui/button-group";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { ControlDefaultsVisualFixture } from "@/components/ui/control-defaults-visual-fixture";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import React from "react";
import { Separator } from "@/components/ui/separator";
import { Toggle } from "@/components/ui/toggle";

export const UiPrimitivesVisualFixture = ({
  includeProgress = false,
  includeControlDefaults = false,
  progressValue,
}: {
  readonly includeProgress?: boolean;
  readonly includeControlDefaults?: boolean;
  readonly progressValue?: number;
} = {}): React.JSX.Element => (
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
        <a className={buttonVariants({ variant: "link" })} href="#as-child">As child</a>
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

    {includeControlDefaults && <ControlDefaultsVisualFixture />}

    {includeProgress && (
      <section className="max-w-3xl space-y-3" data-testid="progress-states">
        <h2>Progress states</h2>
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <p>Indeterminate</p>
            <Progress aria-label="Indeterminate" value={null} />
          </div>
          <div className="space-y-2">
            <p>Zero</p>
            <Progress aria-label="Zero" value={0} />
          </div>
          <div className="space-y-2">
            <p>Complete</p>
            <Progress aria-label="Complete" value={100} />
          </div>
          <div className="space-y-2">
            <p>Updating</p>
            <Progress aria-label="Updating" value={progressValue ?? null} />
          </div>
        </div>
      </section>
    )}

    <section className="grid max-w-3xl grid-cols-[auto_6rem_auto_auto_auto_auto] items-center gap-3">
      <span>Horizontal</span>
      <Separator className="!w-24 shrink-0" />
      <span>Vertical</span>
      <Separator className="!h-8 shrink-0" orientation="vertical" />
      <Popover>
        <PopoverTrigger  render={<Button>Open popover</Button>} />
        <PopoverContent>Popover content</PopoverContent>
      </Popover>
      <Tooltip>
        <TooltipTrigger  render={<Button>Hover tooltip</Button>} />
        <TooltipContent>Tooltip content</TooltipContent>
      </Tooltip>
    </section>
  </main>
);
