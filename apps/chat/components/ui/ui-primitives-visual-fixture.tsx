"use client";

import { BreadcrumbLink } from "@/components/ui/breadcrumb";
/* oxlint-disable sort-imports -- Breadcrumb initializes the UUID crypto binding through utils before ButtonGroup reaches ReactDOM through Separator and calls external DevTools hooks; preserve that observable initialization order. */
import {
  ButtonGroup,
  ButtonGroupSeparator,
  ButtonGroupText,
} from "@/components/ui/button-group";
/* oxlint-enable sort-imports */
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import React from "react";
import { Separator } from "@/components/ui/separator";
/* oxlint-disable import/max-dependencies -- These 12 direct dependencies compose the existing native controls and their shared behavior; retain explicit imports rather than hiding this dependency count behind a barrel. */
import { Slider } from "@/components/ui/slider";
/* oxlint-enable import/max-dependencies */

import { Toggle } from "@/components/ui/toggle";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (UiPrimitivesVisualFixture); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable react/jsx-no-literals -- UiPrimitivesVisualFixture renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */

const SLIDER_START = 20;
const SLIDER_END = 70;
const SLIDER_DEFAULT_RANGE = [SLIDER_START, SLIDER_END];

/* oxlint-disable max-lines-per-function, react/jsx-max-depth -- UiPrimitivesVisualFixture: ; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries */

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

    {includeControlDefaults && (
      <section className="max-w-3xl space-y-3" data-testid="control-defaults">
        <h2>Control defaults</h2>
        <div className="flex gap-4">
          <BreadcrumbLink href="#native-link">Native link</BreadcrumbLink>
          <BreadcrumbLink asChild>
            <a href="#slotted-link">Slotted link</a>
          </BreadcrumbLink>
        </div>
        <Slider
          aria-label="Default range"
          defaultValue={SLIDER_DEFAULT_RANGE}
        />
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel>First panel</ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel>Second panel</ResizablePanel>
          <ResizableHandle withHandle={false} />
          <ResizablePanel>Third panel</ResizablePanel>
        </ResizablePanelGroup>
      </section>
    )}

    {includeProgress && (
      <section className="max-w-3xl space-y-3" data-testid="progress-states">
        <h2>Progress states</h2>
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <p>Missing value</p>
            <Progress aria-label="Missing value" />
          </div>
          <div className="space-y-2">
            <p>Null value</p>
            {/* oxlint-disable-next-line unicorn/no-null -- Radix progress explicitly accepts null as the indeterminate value; cover that native input contract. */}
            <Progress aria-label="Null value" value={null} />
          </div>
          <div className="space-y-2">
            <p>NaN value</p>
            <Progress aria-label="NaN value" value={Number.NaN} />
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
            <p>Negative</p>
            <Progress aria-label="Negative" value={-10} />
          </div>
          <div className="space-y-2">
            <p>Above full scale</p>
            <Progress aria-label="Above full scale" value={150} />
          </div>
          <div className="space-y-2">
            <p>Updating</p>
            <Progress aria-label="Updating" value={progressValue} />
          </div>
        </div>
      </section>
    )}

    <section className="grid max-w-3xl grid-cols-[auto_6rem_auto_auto_auto_auto] items-center gap-3">
      <span>Horizontal</span>
      <Separator
        // oxlint-disable-next-line react/forbid-component-props -- Separator accepts className in its styling contract; preserve this caller's layout and appearance.
        className="!w-24 shrink-0"
      />
      <span>Vertical</span>
      <Separator
        // oxlint-disable-next-line react/forbid-component-props -- Separator accepts className in its styling contract; preserve this caller's layout and appearance.
        className="!h-8 shrink-0"
        orientation="vertical"
      />
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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable max-lines-per-function, react/jsx-max-depth */
