import { ArrowRight, FileText } from "lucide-react";
import React, { useId } from "react";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
/* oxlint-enable sort-imports */
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { useMediaQuery } from "@/hooks/use-media-query";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { getFaviconUrl } from "@/lib/url-utils";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { cn } from "@/lib/utils";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { SearchResultItem } from "@/tools/platform/research-updates-schema";
/* oxlint-enable sort-imports */

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import { Favicon } from "./favicon";
/* oxlint-enable sort-imports */
import { FaviconGroup } from "./favicon-group";
/* oxlint-disable react/jsx-max-depth -- SourcesList: react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; }). */

const SourcesList = ({
  sources,
}: {
  readonly sources: readonly Readonly<SearchResultItem>[] | undefined;
}): React.JSX.Element => (
  <div className="space-y-3">
    {
      /* oxlint-disable oxc/no-optional-chaining -- Keep the existing nullish guard when reading map from sources; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining. */
      sources?.map((source: Readonly<SearchResultItem>): React.JSX.Element => (
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
      ))
      /* oxlint-enable oxc/no-optional-chaining */
    }
  </div>
);
/* oxlint-disable react/jsx-no-literals -- AllSourcesView renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */
/* oxlint-enable react/jsx-max-depth */
/* oxlint-disable max-lines-per-function, react/jsx-max-depth, react/no-multi-comp -- AllSourcesView: max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract */

const AllSourcesView = ({
  sources,
  id,
}: {
  readonly sources: readonly Readonly<SearchResultItem>[] | undefined;
  readonly id?: string;
}): React.JSX.Element => {
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
          // oxlint-disable-next-line react/forbid-component-props -- DialogContent accepts className in its styling contract; preserve this caller's layout and appearance.
          className={cn("max-h-[80vh] overflow-y-auto", "max-w-4xl")}
        >
          <DialogHeader>
            <DialogTitle
              // oxlint-disable-next-line react/forbid-component-props -- DialogTitle accepts className in its styling contract; preserve this caller's layout and appearance.
              className="flex items-center gap-2"
            >
              <FileText
                // oxlint-disable-next-line react/forbid-component-props -- FileText accepts className in its styling contract; preserve this caller's layout and appearance.
                className="h-4 w-4"
              />
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
      <DrawerContent
        // oxlint-disable-next-line react/forbid-component-props -- DrawerContent accepts className in its styling contract; preserve this caller's layout and appearance.
        className="h-[85vh]"
      >
        <DrawerHeader>
          <DrawerTitle
            // oxlint-disable-next-line react/forbid-component-props -- DrawerTitle accepts className in its styling contract; preserve this caller's layout and appearance.
            className="flex items-center gap-2"
          >
            <FileText
              // oxlint-disable-next-line react/forbid-component-props -- FileText accepts className in its styling contract; preserve this caller's layout and appearance.
              className="h-4 w-4"
            />
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
/* oxlint-enable react/jsx-no-literals */
/* oxlint-disable react/jsx-no-literals -- ShowSourcesButton renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */
/* oxlint-enable max-lines-per-function, react/jsx-max-depth, react/no-multi-comp */

/* oxlint-disable react-perf/jsx-no-new-array-as-prop, react/no-multi-comp -- ShowSourcesButton: react-perf/jsx-no-new-array-as-prop: these props derive from the current render; sharing or memoizing them requires a separate identity contract; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract */

const ShowSourcesButton = ({
  sources,
  dialogId,
}: {
  readonly sources: readonly Readonly<SearchResultItem>[];
  readonly dialogId: string;
}): React.JSX.Element => (
  <button
    aria-label="Show all sources"
    className="group border-border hover:bg-accent flex items-center justify-center gap-2 rounded-lg border p-2.5 transition-colors"
    onClick={
      () =>
        /* oxlint-disable oxc/no-optional-chaining -- Keep the existing nullish guard when reading click from document.querySelector(...); preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining. */
        document.querySelector<HTMLElement>(`#${dialogId}`)?.click()
      /* oxlint-enable oxc/no-optional-chaining */
    }
    type="button"
  >
    <FaviconGroup
      // oxlint-disable-next-line react/forbid-component-props -- FaviconGroup accepts className in its styling contract; preserve this caller's layout and appearance.
      className="mr-1.5"
      maxVisible={3}
      sources={sources.map((source) => ({
        title: source.title,
        url: source.url,
      }))}
    />
    <span className="text-muted-foreground group-hover:text-foreground text-xs">
      {sources.length} Sources
    </span>
    <ArrowRight
      // oxlint-disable-next-line react/forbid-component-props -- ArrowRight accepts className in its styling contract; preserve this caller's layout and appearance.
      className="text-muted-foreground group-hover:text-foreground h-3.5 w-3.5 transition-colors"
    />
  </button>
);
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (Sources); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable react-perf/jsx-no-new-array-as-prop, react/no-multi-comp */
/* oxlint-disable no-magic-numbers, react/no-multi-comp, unicorn/no-null -- no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 0); react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

export const Sources = ({
  sources,
}: {
  readonly sources: readonly Readonly<SearchResultItem>[];
}): React.JSX.Element | null => {
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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable no-magic-numbers, react/no-multi-comp, unicorn/no-null */
