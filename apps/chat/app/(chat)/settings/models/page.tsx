import { ExternalLink } from "lucide-react";
import { Suspense } from "react";
import { ModelsSettings } from "@/components/settings/models-settings";
import {
  SettingsPage,
  SettingsPageHeader,
} from "@/components/settings/settings-page";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getQueryClient, HydrateClient, trpc } from "@/trpc/server";

function ModelsSettingsHeader({
  showRegistryLink = false,
}: {
  showRegistryLink?: boolean;
}) {
  return (
    <SettingsPageHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 className="font-semibold text-lg">Models</h2>
        <p className="text-muted-foreground text-sm">
          Configure your AI model preferences.
        </p>
      </div>
      {showRegistryLink ? (
        <Button
          asChild
          className="w-full max-w-[300px] sm:w-auto"
          size="sm"
          variant="outline"
        >
          <a
            href="https://airegistry.app"
            rel="noopener noreferrer"
            target="_blank"
          >
            <ExternalLink className="size-4" />
            <span>Models Registry</span>
          </a>
        </Button>
      ) : (
        <Skeleton className="h-8 w-full max-w-[300px] sm:w-36" />
      )}
    </SettingsPageHeader>
  );
}

export default function ModelsSettingsPage() {
  return (
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
}

async function ModelsSettingsContent() {
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(
    trpc.settings.getModelPreferences.queryOptions()
  );

  return (
    <HydrateClient>
      <SettingsPage>
        <ModelsSettingsHeader showRegistryLink />
        <ModelsSettings />
      </SettingsPage>
    </HydrateClient>
  );
}
