import { ExternalLink } from "lucide-react";
import React, { Suspense } from "react";

import { ModelsSettings } from "@/components/settings/models-settings";
import {
  SettingsPage,
  SettingsPageHeader,
} from "@/components/settings/settings-page";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { HydrateClient, getQueryClient, trpc } from "@/trpc/server";

/* oxlint-disable react/jsx-max-depth, typescript/prefer-readonly-parameter-types -- ModelsSettingsHeader: react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const ModelsSettingsHeader = ({
  showRegistryLink = false,
}: {
  showRegistryLink?: boolean;
}): React.JSX.Element => (
  <SettingsPageHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
    <div>
      <h2 className="text-lg font-semibold">Models</h2>
      <p className="text-muted-foreground text-sm">
        Configure your AI model preferences.
      </p>
    </div>
    {showRegistryLink ? (
      <Button
        asChild
        className="w-full max-w-[300px] sm:w-auto"
        size="sm"
        variant="outline"
      >
        <a
          href="https://airegistry.app"
          rel="noopener noreferrer"
          target="_blank"
        >
          <ExternalLink className="size-4" />
          <span>Models Registry</span>
        </a>
      </Button>
    ) : (
      <Skeleton className="h-8 w-full max-w-[300px] sm:w-36" />
    )}
  </SettingsPageHeader>
);
/* oxlint-enable react/jsx-max-depth, typescript/prefer-readonly-parameter-types */
/* oxlint-disable react/no-multi-comp, typescript/explicit-function-return-type -- ModelsSettingsContent: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result. */

const ModelsSettingsContent = async () => {
  const queryClient = getQueryClient();

  await queryClient.prefetchQuery(
    trpc.settings.getModelPreferences.queryOptions()
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
/* oxlint-enable react/no-multi-comp, typescript/explicit-function-return-type */

/* oxlint-disable react-perf/jsx-no-jsx-as-prop, react/jsx-max-depth, react/no-multi-comp -- ModelsSettingsPage: react-perf/jsx-no-jsx-as-prop: this component composition slot accepts an element from the current render; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract. */

const ModelsSettingsPage = (): React.JSX.Element => (
  <Suspense
    fallback={
      <SettingsPage>
        <ModelsSettingsHeader />
        <div className="flex flex-col gap-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-5/6" />
        </div>
      </SettingsPage>
    }
  >
    <ModelsSettingsContent />
  </Suspense>
);
/* oxlint-enable react-perf/jsx-no-jsx-as-prop, react/jsx-max-depth, react/no-multi-comp */
/* oxlint-disable import/no-default-export -- page route: import/no-default-export: Next.js loads this route entry point through its required default export. */

export default ModelsSettingsPage;
/* oxlint-enable import/no-default-export */
