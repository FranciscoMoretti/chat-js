"use client";

import { Item, ItemContent, ItemMedia, ItemTitle } from "@/components/ui/item";
import { DrawerCloseButton } from "@/components/drawer-close-button";
import { ArrowRight, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

import React from "react";
import { Favicon } from "./favicon";

import { Trace, TraceIcon, TraceLine, TraceTitle } from "@/components/ui/trace";

import type { SearchResultItem } from "@/tools/platform/research-updates-schema";

import { cn } from "@/lib/utils";

import { getFaviconUrl } from "@/lib/url-utils";

import { useMediaQuery } from "@/hooks/use-media-query";

const SourcesList = ({
  sources,
}: {
  readonly sources: readonly Readonly<SearchResultItem>[] | undefined;
}): React.JSX.Element => (
  <div className="flex flex-col gap-3">
    {sources?.map((source) => (
      <a
        aria-label={source.title}
        href={source.url}
        key={source.url}
        rel="noopener noreferrer"
        target="_blank"
      >
        <Item variant="muted">
          <ItemMedia>
            <Favicon url={getFaviconUrl(source)} />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>{source.title}</ItemTitle>
          </ItemContent>
        </Item>
      </a>
    ))}
  </div>
);

const SourcesLabel = ({
  count,
}: {
  readonly count: number;
}): React.JSX.Element => (
  <TraceLine>
    <TraceIcon>
      <FileText />
    </TraceIcon>
    <TraceTitle>{count} Sources</TraceTitle>
    <TraceIcon>
      <ArrowRight />
    </TraceIcon>
  </TraceLine>
);

const AllSourcesView = ({
  sources,
}: {
  readonly sources: readonly Readonly<SearchResultItem>[] | undefined;
}): React.JSX.Element => {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const title = "All Sources";

  if (isDesktop) {
    return (
      <Dialog>
        <Trace>
          <DialogTrigger aria-label="Show all sources">
            <SourcesLabel count={sources?.length ?? 0} />
          </DialogTrigger>
        </Trace>
        <DialogContent
          className={cn("max-h-[80vh] overflow-y-auto", "max-w-4xl")}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              {title}
            </DialogTitle>
          </DialogHeader>
          <SourcesList sources={sources} />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer>
      <Trace>
        <DrawerTrigger aria-label="Show all sources">
          <SourcesLabel count={sources?.length ?? 0} />
        </DrawerTrigger>
      </Trace>
      <DrawerContent className="h-[85vh]">
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {title}
          </DrawerTitle>
        </DrawerHeader>
        <div className="overflow-y-auto p-4">
          <SourcesList sources={sources} />
        </div>
        <DrawerFooter>
          <DrawerCloseButton variant="outline">Close</DrawerCloseButton>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};

export const Sources = ({
  sources,
}: {
  readonly sources: readonly Readonly<SearchResultItem>[];
}): React.JSX.Element | null =>
  sources.length === 0 ? null : <AllSourcesView sources={sources} />;
