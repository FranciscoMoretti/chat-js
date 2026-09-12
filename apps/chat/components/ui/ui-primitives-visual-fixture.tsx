"use client";

import { Button } from "@/components/ui/button";
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
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const UiPrimitivesVisualFixture = () => (
  <main className="space-y-8 p-8" data-testid="ui-primitives-fixture">
    <section className="space-y-3">
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

    <section className="space-y-3">
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

    <section className="flex items-center gap-3">
      <span>Horizontal</span>
      <Separator className="w-24" />
      <span>Vertical</span>
      <Separator className="h-8" orientation="vertical" />
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
