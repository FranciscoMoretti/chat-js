import { Suspense } from "react";
import { ConnectorsSettings } from "@/components/settings/connectors-settings";
import {
  SettingsPage,
  SettingsPageHeader,
} from "@/components/settings/settings-page";
import { Skeleton } from "@/components/ui/skeleton";
import { getQueryClient, HydrateClient, trpc } from "@/trpc/server";

function ConnectorsSettingsHeader() {
  return (
    <SettingsPageHeader>
      <h2 className="font-semibold text-lg">Connectors & MCP</h2>
      <p className="text-muted-foreground text-sm">
        Connect to Model Context Protocol servers to extend AI capabilities with
        external tools.
      </p>
    </SettingsPageHeader>
  );
}

export default function ConnectorsSettingsPage() {
  return (
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
}

async function ConnectorsSettingsContent() {
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
}
