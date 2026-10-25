import React, { Suspense } from "react";

import { ModelsSettings } from "./models-settings";
import {
  SettingsPage,
  SettingsPageHeader,
} from "@/components/settings/settings-page";
import { Skeleton } from "@/components/ui/skeleton";
import { preloadQuery } from "@/trpc/preload-query";
import { HydrateClient, getQueryClient, trpc } from "@/trpc/server";

const ModelsSettingsHeader = (): React.JSX.Element => (
  <SettingsPageHeader>
    <h2 className="text-lg font-semibold">Models</h2>
    <p className="text-muted-foreground text-sm">
      Configure your AI model preferences.
    </p>
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
        <ModelsSettingsHeader />
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
