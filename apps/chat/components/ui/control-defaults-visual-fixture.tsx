"use client";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { BreadcrumbLink } from "@/components/ui/breadcrumb";
import React from "react";
import { Slider } from "@/components/ui/slider";

const SLIDER_START = 20;
const SLIDER_END = 70;
const SLIDER_DEFAULT_RANGE = [SLIDER_START, SLIDER_END];

/* oxlint-disable import/prefer-default-export, import/no-named-export -- The parent fixture uses this named control-defaults capture; the pinned import/no-default-export rule rejects a default export. */
/* oxlint-disable react/jsx-no-literals -- These authored labels identify the native links, slider and resize panels in the default-state capture. */
export const ControlDefaultsVisualFixture = (): React.JSX.Element => {
  const slottedLink = (
    <BreadcrumbLink asChild>
      <a href="#slotted-link">Slotted link</a>
    </BreadcrumbLink>
  );

  return (
    <section className="max-w-3xl space-y-3" data-testid="control-defaults">
      <h2>Control defaults</h2>
      <div className="flex gap-4">
        <BreadcrumbLink href="#native-link">Native link</BreadcrumbLink>
        {slottedLink}
      </div>
      <Slider aria-label="Default range" defaultValue={SLIDER_DEFAULT_RANGE} />
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel>First panel</ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel>Second panel</ResizablePanel>
        <ResizableHandle withHandle={false} />
        <ResizablePanel>Third panel</ResizablePanel>
      </ResizablePanelGroup>
    </section>
  );
};
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable import/prefer-default-export, import/no-named-export */
