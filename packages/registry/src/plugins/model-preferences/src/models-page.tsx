import { ExternalLink } from "lucide-react";
import React, { Suspense } from "react";

import { ModelsSettings } from "./models-settings";
import {
  SettingsPage,
  SettingsPageHeader,
} from "@/components/settings/settings-page";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { preloadQuery } from "@/trpc/preload-query";
import { HydrateClient, getQueryClient, trpc } from "@/trpc/server";

const ModelsSettingsHeader = ({
  showRegistryLink = false,
}: {
  readonly showRegistryLink?: boolean;
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

const ModelsSettingsContent = async (): Promise<React.JSX.Element> => {
  const queryClient = getQueryClient();

  // Preloading populates the settings hydration cache and intentionally swallows preload failures.
  await preloadQuery(
    queryClient.query(trpc.modelPreferences.getModelPreferences.queryOptions())
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
export { ModelsSettingsPage };
