import { ArrowRight, FileText } from "lucide-react";
import React, { useId } from "react";

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
/* oxlint-disable react/jsx-max-depth, typescript/prefer-readonly-parameter-types -- SourcesList: react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { sources, }: { sources: SearchResultItem[] | undefined; }). */

const SourcesList = ({
  sources,
}: {
  sources: SearchResultItem[] | undefined;
}): React.JSX.Element => (
  <div className="space-y-3">
    {sources?.map((source: SearchResultItem): React.JSX.Element => (
      <a
        aria-label={source.title}
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
/* oxlint-enable react/jsx-max-depth, typescript/prefer-readonly-parameter-types */
/* oxlint-disable max-lines-per-function, react/forbid-component-props, react/jsx-max-depth, react/jsx-no-literals, react/no-multi-comp, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types -- AllSourcesView: max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/jsx-no-literals: these existing labels and accessible text are this feature content; localization is a separate content migration; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

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
/* oxlint-enable max-lines-per-function, react/forbid-component-props, react/jsx-max-depth, react/jsx-no-literals, react/no-multi-comp, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types */

/* oxlint-disable id-length, react-perf/jsx-no-new-array-as-prop, react-perf/jsx-no-new-function-as-prop, react/forbid-component-props, react/jsx-no-literals, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- ShowSourcesButton: id-length: retain conventional event, index, and generic identifiers in this existing callback contract; react-perf/jsx-no-new-array-as-prop: these props derive from the current render; sharing or memoizing them requires a separate identity contract; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-no-literals: these existing labels and accessible text are this feature content; localization is a separate content migration; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const ShowSourcesButton = ({
  sources,
  dialogId,
}: {
  sources: SearchResultItem[];
  dialogId: string;
}): React.JSX.Element => (
  <button
    aria-label="Show all sources"
    className="group border-border hover:bg-accent flex items-center justify-center gap-2 rounded-lg border p-2.5 transition-colors"
    onClick={() => document.querySelector<HTMLElement>(`#${dialogId}`)?.click()}
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
/* oxlint-enable id-length, react-perf/jsx-no-new-array-as-prop, react-perf/jsx-no-new-function-as-prop, react/forbid-component-props, react/jsx-no-literals, react/no-multi-comp, typescript/prefer-readonly-parameter-types */
/* oxlint-disable no-magic-numbers, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, unicorn/no-null -- Sources: ; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 0); react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { sources }: { sources: SearchResultItem[] }); unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

export const Sources = ({ sources }: { sources: SearchResultItem[] }) => {
  const sourcesDialogId = useId();
  if (sources.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <ShowSourcesButton dialogId={sourcesDialogId} sources={sources} />
      <div className="hidden">
        <AllSourcesView id={sourcesDialogId} sources={sources} />
      </div>
    </div>
  );
};
/* oxlint-enable no-magic-numbers, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, unicorn/no-null */
