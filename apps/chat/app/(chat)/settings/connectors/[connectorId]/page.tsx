import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { connection } from "next/server";
import React, { Suspense } from "react";

import { McpDetailsPage } from "@/components/settings/mcp-details-page";
import {
  SettingsPage,
  SettingsPageHeader,
} from "@/components/settings/settings-page";
import { Skeleton } from "@/components/ui/skeleton";
import { makeQueryClient } from "@/trpc/query-client";
import { preloadQuery } from "@/trpc/preload-query";
import { trpc } from "@/trpc/server";

const ConnectorDetailsHeader = (): React.JSX.Element => (
  <SettingsPageHeader>
    <h2 className="text-lg font-semibold">Connector details</h2>
    <p className="text-muted-foreground text-sm">
      Tools, resources, and authorization status.
    </p>
  </SettingsPageHeader>
);

const ConnectorDetailsBodyFallback = (): React.JSX.Element => (
  <div className="flex flex-col gap-3">
    <Skeleton className="h-10 w-48" />
    <Skeleton className="h-24 w-full" />
    <Skeleton className="h-24 w-full" />
    <Skeleton className="h-16 w-5/6" />
  </div>
);

const ConnectorDetailsContent = async ({
  params,
}: {
  readonly params: Readonly<Promise<{ readonly connectorId: string }>>;
}): Promise<React.JSX.Element> => {
  const { connectorId } = await params;
  await connection();
  // Keep this result out of the layout's earlier hydration boundary.
  const queryClient = makeQueryClient();
  await preloadQuery(queryClient.query(trpc.mcp.list.queryOptions()));
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <SettingsPage>
        <ConnectorDetailsHeader />
        <Suspense fallback={<ConnectorDetailsBodyFallback />}>
          <McpDetailsPage connectorId={connectorId} />
        </Suspense>
      </SettingsPage>
    </HydrationBoundary>
  );
};

const ConnectorDetailsPage = ({
  params,
}: {
  readonly params: Readonly<Promise<{ readonly connectorId: string }>>;
}): React.JSX.Element => (
  <Suspense
    fallback={
      <SettingsPage>
        <ConnectorDetailsHeader />
        <ConnectorDetailsBodyFallback />
      </SettingsPage>
    }
  >
    <ConnectorDetailsContent params={params} />
  </Suspense>
);

export default ConnectorDetailsPage;
