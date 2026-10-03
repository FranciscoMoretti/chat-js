import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { connection } from "next/server";
import { Suspense } from "react";

import { ConnectorsSettings } from "@/components/settings/connectors-settings";
import {
  SettingsPage,
  SettingsPageHeader,
} from "@/components/settings/settings-page";
import { Skeleton } from "@/components/ui/skeleton";
import { makeQueryClient } from "@/trpc/query-client";
import { trpc } from "@/trpc/server";

const ConnectorsSettingsHeader = () => (
  <SettingsPageHeader>
    <h2 className="text-lg font-semibold">Connectors & MCP</h2>
    <p className="text-muted-foreground text-sm">
      Connect to Model Context Protocol servers to extend AI capabilities with
      external tools.
    </p>
  </SettingsPageHeader>
);

const ConnectorsSettingsContent = async () => {
  await connection();
  // Keep this result out of the layout's earlier hydration boundary.
  const queryClient = makeQueryClient();
  // oxlint-disable-next-line typescript/no-deprecated -- #583: Keep the v5 prefetch API and its error-swallowing hydration semantics across locked and freshly scaffolded Query versions.
  await queryClient.prefetchQuery(trpc.mcp.list.queryOptions());

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <SettingsPage>
        <ConnectorsSettingsHeader />
        <ConnectorsSettings />
      </SettingsPage>
    </HydrationBoundary>
  );
};

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
