import { Suspense } from "react";
import { McpDetailsPage } from "@/components/settings/mcp-details-page";
import {
  SettingsPage,
  SettingsPageHeader,
} from "@/components/settings/settings-page";
import { Skeleton } from "@/components/ui/skeleton";
import { getQueryClient, HydrateClient, trpc } from "@/trpc/server";

function ConnectorDetailsHeader() {
  return (
    <SettingsPageHeader>
      <h2 className="font-semibold text-lg">Connector details</h2>
      <p className="text-muted-foreground text-sm">
        Tools, resources, and authorization status.
      </p>
    </SettingsPageHeader>
  );
}

function ConnectorDetailsBodyFallback() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-16 w-5/6" />
    </div>
  );
}

export default function ConnectorDetailsPage({
  params,
}: {
  params: Promise<{ connectorId: string }>;
}) {
  return (
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
}

async function ConnectorDetailsContent({
  params,
}: {
  params: Promise<{ connectorId: string }>;
}) {
  const { connectorId } = await params;
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(trpc.mcp.list.queryOptions());
  return (
    <HydrateClient>
      <SettingsPage>
        <ConnectorDetailsHeader />
        <Suspense fallback={<ConnectorDetailsBodyFallback />}>
          <McpDetailsPage connectorId={connectorId} />
        </Suspense>
      </SettingsPage>
    </HydrateClient>
  );
}
