import { Suspense } from "react";
import { ConnectorsSettings } from "@/components/settings/connectors-settings";
import {
  SettingsPage,
  SettingsPageHeader,
} from "@/components/settings/settings-page";
import { getQueryClient, HydrateClient, trpc } from "@/trpc/server";

export default function ConnectorsSettingsPage() {
  return (
    <Suspense fallback={<ConnectorsSettingsFallback />}>
      <ConnectorsSettingsContent />
    </Suspense>
  );
}

function ConnectorsSettingsFallback() {
  return (
    <SettingsPage>
      <SettingsPageHeader>
        <h2 className="font-semibold text-lg">Connectors & MCP</h2>
        <p className="text-muted-foreground text-sm">
          Connect to Model Context Protocol servers to extend AI capabilities
          with external tools.
        </p>
      </SettingsPageHeader>
    </SettingsPage>
  );
}

async function ConnectorsSettingsContent() {
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(trpc.mcp.list.queryOptions());

  return (
    <HydrateClient>
      <SettingsPage>
        <SettingsPageHeader>
          <h2 className="font-semibold text-lg">Connectors & MCP</h2>
          <p className="text-muted-foreground text-sm">
            Connect to Model Context Protocol servers to extend AI capabilities
            with external tools.
          </p>
        </SettingsPageHeader>
        <ConnectorsSettings />
      </SettingsPage>
    </HydrateClient>
  );
}
