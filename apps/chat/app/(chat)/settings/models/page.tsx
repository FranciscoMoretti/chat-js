import { ExternalLink } from "lucide-react";
import { Suspense } from "react";
import { ModelsSettings } from "@/components/settings/models-settings";
import {
  SettingsPage,
  SettingsPageHeader,
} from "@/components/settings/settings-page";
import { Button } from "@/components/ui/button";
import { getQueryClient, HydrateClient, trpc } from "@/trpc/server";

export default function ModelsSettingsPage() {
  return (
    <Suspense fallback={<ModelsSettingsFallback />}>
      <ModelsSettingsContent />
    </Suspense>
  );
}

function ModelsSettingsFallback() {
  return (
    <SettingsPage>
      <SettingsPageHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-semibold text-lg">Models</h2>
          <p className="text-muted-foreground text-sm">
            Configure your AI model preferences.
          </p>
        </div>
      </SettingsPageHeader>
    </SettingsPage>
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
        <SettingsPageHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-semibold text-lg">Models</h2>
            <p className="text-muted-foreground text-sm">
              Configure your AI model preferences.
            </p>
          </div>
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
        </SettingsPageHeader>
        <ModelsSettings />
      </SettingsPage>
    </HydrateClient>
  );
}
