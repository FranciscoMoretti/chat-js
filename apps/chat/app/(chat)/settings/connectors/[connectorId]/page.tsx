import { Suspense } from "react";
import { McpDetailsPage } from "@/components/settings/mcp-details-page";
import {
  SettingsPage,
  SettingsPageHeader,
} from "@/components/settings/settings-page";
import { getQueryClient, HydrateClient, trpc } from "@/trpc/server";

export default function ConnectorDetailsPage({
  params,
}: {
  params: Promise<{ connectorId: string }>;
}) {
  return (
    <Suspense fallback={<ConnectorDetailsFallback />}>
      <ConnectorDetailsContent params={params} />
    </Suspense>
  );
}

function ConnectorDetailsFallback() {
  return (
    <SettingsPage>
      <SettingsPageHeader>
        <h2 className="font-semibold text-lg">Connector details</h2>
        <p className="text-muted-foreground text-sm">
          Tools, resources, and authorization status.
        </p>
      </SettingsPageHeader>
    </SettingsPage>
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
        <SettingsPageHeader>
          <h2 className="font-semibold text-lg">Connector details</h2>
          <p className="text-muted-foreground text-sm">
            Tools, resources, and authorization status.
          </p>
        </SettingsPageHeader>
        <Suspense fallback={null}>
          <McpDetailsPage connectorId={connectorId} />
        </Suspense>
      </SettingsPage>
    </HydrateClient>
  );
}
