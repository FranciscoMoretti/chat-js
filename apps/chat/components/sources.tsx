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
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { useMediaQuery } from "@/hooks/use-media-query";
import { getFaviconUrl } from "@/lib/url-utils";
import { cn } from "@/lib/utils";
import type { SearchResultItem } from "@/tools/platform/research-updates-schema";

import { Favicon } from "./favicon";
import { FaviconGroup } from "./favicon-group";

const SourcesList = ({
  sources,
}: {
  sources: SearchResultItem[] | undefined;
}) => (
  <div className="space-y-3">
    {sources?.map((source: SearchResultItem) => (
      <a
        className="bg-secondary hover:bg-accent block rounded-lg p-4 transition-colors"
        href={source.url}
        key={source.url}
        rel="noopener noreferrer"
        target="_blank"
      >
        <div className="flex items-start gap-3">
          <div className="mt-1 shrink-0">
            <Favicon url={getFaviconUrl(source)} />
          </div>
          <div className="flex flex-col gap-1">
            <h4 className="text-sm leading-tight font-medium">
              {source.title}
            </h4>
          </div>
        </div>
      </a>
    ))}
  </div>
);

const AllSourcesView = ({
  sources,
  id,
}: {
  sources: SearchResultItem[] | undefined;
  id?: string;
}) => {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const title = "All Sources";

  if (isDesktop) {
    return (
      <Dialog>
        <DialogTrigger asChild>
          <button className="hidden" id={id} type="button">
            Show All
          </button>
        </DialogTrigger>
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
      <DrawerTrigger asChild>
        <button className="hidden" id={id} type="button">
          Show All
        </button>
      </DrawerTrigger>
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
      </DrawerContent>
    </Drawer>
  );
};

const ShowSourcesButton = ({
  sources,
  dialogId,
}: {
  sources: SearchResultItem[];
  dialogId: string;
}) => (
  <button
    className="group border-border hover:bg-accent flex items-center justify-center gap-2 rounded-lg border p-2.5 transition-colors"
    onClick={() => document.getElementById(dialogId)?.click()}
    type="button"
  >
    <FaviconGroup
      className="mr-1.5"
      maxVisible={3}
      sources={sources.map((s) => ({
        title: s.title,
        url: s.url,
      }))}
    />
    <span className="text-muted-foreground group-hover:text-foreground text-xs">
      {sources.length} Sources
    </span>
    <ArrowRight className="text-muted-foreground group-hover:text-foreground h-3.5 w-3.5 transition-colors" />
  </button>
);

export const Sources = ({ sources }: { sources: SearchResultItem[] }) => {
  if (sources.length === 0) {
    return null;
  }

  const sourcesDialogId = "show-all-sources-dialog";

  return (
    <div className="space-y-3">
      <ShowSourcesButton dialogId={sourcesDialogId} sources={sources} />
      <div className="hidden">
        <AllSourcesView id={sourcesDialogId} sources={sources} />
      </div>
    </div>
  );
};
