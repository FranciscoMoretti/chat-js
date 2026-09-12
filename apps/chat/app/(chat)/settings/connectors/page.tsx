import { Suspense } from "react";

import { ConnectorsSettings } from "@/components/settings/connectors-settings";
import {
  SettingsPage,
  SettingsPageHeader,
} from "@/components/settings/settings-page";
import { Skeleton } from "@/components/ui/skeleton";
import { getQueryClient, HydrateClient, trpc } from "@/trpc/server";

const ConnectorsSettingsHeader = () => (
  <SettingsPageHeader>
    <h2 className="text-lg font-semibold">Connectors & MCP</h2>
    <p className="text-muted-foreground text-sm">
      Connect to Model Context Protocol servers to extend AI capabilities with
      external tools.
    </p>
  </SettingsPageHeader>
);

const ConnectorsSettingsPage = () => (
  <Suspense
    fallback={
      <SettingsPage>
        <ConnectorsSettingsHeader />
        <div className="flex flex-col gap-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-5/6" />
        </div>
      </SettingsPage>
    }
  >
    <ConnectorsSettingsContent />
  </Suspense>
);

export default ConnectorsSettingsPage;

const ConnectorsSettingsContent = async () => {
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(trpc.mcp.list.queryOptions());

  return (
    <HydrateClient>
      <SettingsPage>
        <ConnectorsSettingsHeader />
        <ConnectorsSettings />
      </SettingsPage>
    </HydrateClient>
  );
};
