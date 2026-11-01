import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { connection } from "next/server";
import React, { Suspense } from "react";

import { ConnectorsSettings } from "@/chatjs/plugins/mcp/ui/connectors-settings";
import {
  SettingsPage,
  SettingsPageHeader,
} from "@/components/settings/settings-page";
import { Skeleton } from "@/components/ui/skeleton";
import { makeQueryClient } from "@/trpc/query-client";
import { preloadQuery } from "@/trpc/preload-query";
import { trpc } from "@/trpc/server";

const ConnectorsSettingsHeader = (): React.JSX.Element => (
  <SettingsPageHeader>
    <h2 className="text-lg font-semibold">Connectors & MCP</h2>
    <p className="text-muted-foreground text-sm">
      Connect to Model Context Protocol servers to extend AI capabilities with
      external tools.
    </p>
  </SettingsPageHeader>
);

const ConnectorsSettingsContent = async (): Promise<React.JSX.Element> => {
  await connection();
  // Keep this result out of the layout's earlier hydration boundary.
  const queryClient = makeQueryClient();
  await preloadQuery(queryClient.query(trpc.mcp.list.queryOptions()));

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <SettingsPage>
        <ConnectorsSettingsHeader />
        <ConnectorsSettings />
      </SettingsPage>
    </HydrationBoundary>
  );
};

const ConnectorsSettingsPage = (): React.JSX.Element => (
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

export { ConnectorsSettingsPage };
