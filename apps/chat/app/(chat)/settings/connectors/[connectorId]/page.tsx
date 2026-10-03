import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { connection } from "next/server";
import { Suspense } from "react";

import { McpDetailsPage } from "@/components/settings/mcp-details-page";
import {
  SettingsPage,
  SettingsPageHeader,
} from "@/components/settings/settings-page";
import { Skeleton } from "@/components/ui/skeleton";
import { makeQueryClient } from "@/trpc/query-client";
import { trpc } from "@/trpc/server";

const ConnectorDetailsHeader = () => (
  <SettingsPageHeader>
    <h2 className="text-lg font-semibold">Connector details</h2>
    <p className="text-muted-foreground text-sm">
      Tools, resources, and authorization status.
    </p>
  </SettingsPageHeader>
);

const ConnectorDetailsBodyFallback = () => (
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
  params: Promise<{ connectorId: string }>;
}) => {
  const { connectorId } = await params;
  await connection();
  // Keep this result out of the layout's earlier hydration boundary.
  const queryClient = makeQueryClient();
  // oxlint-disable-next-line typescript/no-deprecated -- #583: Keep the v5 prefetch API and its error-swallowing hydration semantics across locked and freshly scaffolded Query versions.
  await queryClient.prefetchQuery(trpc.mcp.list.queryOptions());
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
  params: Promise<{ connectorId: string }>;
}) => (
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
