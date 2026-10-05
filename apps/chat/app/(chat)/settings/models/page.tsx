import { ExternalLink } from "lucide-react";
import type { JSX as ReactJSX } from "react";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import React, { Suspense } from "react";
/* oxlint-enable sort-imports */

import { ModelsSettings } from "@/components/settings/models-settings";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  SettingsPage,
  SettingsPageHeader,
} from "@/components/settings/settings-page";
/* oxlint-enable sort-imports */
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { preloadQuery } from "@/trpc/preload-query";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { HydrateClient, getQueryClient, trpc } from "@/trpc/server";
/* oxlint-enable sort-imports */

/* oxlint-disable react/jsx-max-depth -- ModelsSettingsHeader: react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const ModelsSettingsHeader = ({
  showRegistryLink = false,
}: {
  readonly showRegistryLink?: boolean;
}): React.JSX.Element => (
  <SettingsPageHeader
    // oxlint-disable-next-line react/forbid-component-props -- SettingsPageHeader accepts className in its styling contract; preserve this caller's layout and appearance.
    className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
  >
    <div>
      <h2 className="text-lg font-semibold">Models</h2>
      <p className="text-muted-foreground text-sm">
        Configure your AI model preferences.
      </p>
    </div>
    {showRegistryLink ? (
      <Button
        asChild
        // oxlint-disable-next-line react/forbid-component-props -- Button accepts className in its styling contract; preserve this caller's layout and appearance.
        className="w-full max-w-[300px] sm:w-auto"
        size="sm"
        variant="outline"
      >
        <a
          href="https://airegistry.app"
          rel="noopener noreferrer"
          target="_blank"
        >
          <ExternalLink
            // oxlint-disable-next-line react/forbid-component-props -- ExternalLink accepts className in its styling contract; preserve this caller's layout and appearance.
            className="size-4"
          />
          <span>Models Registry</span>
        </a>
      </Button>
    ) : (
      <Skeleton
        // oxlint-disable-next-line react/forbid-component-props -- Skeleton accepts className in its styling contract; preserve this caller's layout and appearance.
        className="h-8 w-full max-w-[300px] sm:w-36"
      />
    )}
  </SettingsPageHeader>
);
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve ModelsSettingsContent's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable react/jsx-max-depth */
/* oxlint-disable react/no-multi-comp -- ModelsSettingsContent: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result. */

const ModelsSettingsContent = async (): Promise<ReactJSX.Element> => {
  const queryClient = getQueryClient();

  // Preloading populates the settings hydration cache and intentionally swallows preload failures.
  await preloadQuery(
    queryClient.query(trpc.settings.getModelPreferences.queryOptions())
  );

  return (
    <HydrateClient>
      <SettingsPage>
        <ModelsSettingsHeader showRegistryLink />
        <ModelsSettings />
      </SettingsPage>
    </HydrateClient>
  );
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable react/no-multi-comp */

/* oxlint-disable react-perf/jsx-no-jsx-as-prop, react/jsx-max-depth, react/no-multi-comp -- ModelsSettingsPage: react-perf/jsx-no-jsx-as-prop: this component composition slot accepts an element from the current render; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract. */

const ModelsSettingsPage = (): React.JSX.Element => (
  <Suspense
    fallback={
      <SettingsPage>
        <ModelsSettingsHeader />
        <div className="flex flex-col gap-3">
          <Skeleton
            // oxlint-disable-next-line react/forbid-component-props -- Skeleton accepts className in its styling contract; preserve this caller's layout and appearance.
            className="h-12 w-full"
          />
          <Skeleton
            // oxlint-disable-next-line react/forbid-component-props -- Skeleton accepts className in its styling contract; preserve this caller's layout and appearance.
            className="h-12 w-full"
          />
          <Skeleton
            // oxlint-disable-next-line react/forbid-component-props -- Skeleton accepts className in its styling contract; preserve this caller's layout and appearance.
            className="h-12 w-5/6"
          />
        </div>
      </SettingsPage>
    }
  >
    <ModelsSettingsContent />
  </Suspense>
);
/* oxlint-enable react-perf/jsx-no-jsx-as-prop, react/jsx-max-depth, react/no-multi-comp */
// oxlint-disable-next-line import/no-default-export -- Next.js 16.3 discovers this page module and create-component-tree selects its default component ModelsSettingsPage.
export default ModelsSettingsPage;
