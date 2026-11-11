"use client";

import { Suspense, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Brand } from "./brand";
import { Monitor, Smartphone } from "lucide-react";
import { CreateSkeleton } from "@/vendor/shadcn-create/components/create-skeleton";
import { Customizer } from "@/vendor/shadcn-create/components/customizer";
import { Preview } from "@/vendor/shadcn-create/components/preview";
import { PreviewOverrideProvider } from "@/vendor/shadcn-create/components/preview-override";
import { PresetHandler } from "@/vendor/shadcn-create/components/preset-handler";
import { HistoryButtons } from "@/vendor/shadcn-create/components/history-buttons";
import { ModeSwitcher } from "@/vendor/shadcn-create/components/mode-switcher";
import { ShareButton } from "@/vendor/shadcn-create/components/share-button";
import { Button } from "@/vendor/shadcn-create/styles/base-nova/ui/button";
import { HistoryProvider } from "@/vendor/shadcn-create/hooks/use-history";
import { LocksProvider } from "@/vendor/shadcn-create/hooks/use-locks";
import { useDesignSystemSearchParams } from "@/vendor/shadcn-create/lib/search-params";
import {
  InstallationProvider,
  useInstallation,
} from "./create-preview/installation-provider";
import type { InstallationCatalogItem } from "../../../packages/registry/installation-catalog";
import type {
  ConfigureSetup,
  SetupDestination,
} from "./create-preview/setup-guidance";
import { SetupConfiguration } from "./create-preview/setup-configuration";
import { ToolsConfiguration } from "./create-preview/tools-configuration";
import {
  InstallationPanel,
  InstallationRequirements,
} from "./create-preview/installation-panel";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/vendor/shadcn-create/styles/base-nova/ui/tabs";

const ProjectForm = dynamic(
  async () => {
    const imported = await import("@/components/create-preview/project-form");
    return imported.ProjectForm;
  },
  { ssr: false, loading: () => <Button disabled>Get Code</Button> }
);
const previewItems = [
  {
    name: "preview-02",
    title: "Chat conversation",
    type: "registry:block" as const,
  },
  { name: "preview", title: "New chat", type: "registry:block" as const },
  {
    name: "preview-tools",
    title: "Tool examples",
    type: "registry:block" as const,
  },
];
const itemsByBase = { base: previewItems, radix: previewItems };

const CreateWorkspace = () => {
  const [params, setParams] = useDesignSystemSearchParams();
  const [view, setView] = useState("appearance");
  const [setupRequest, setSetupRequest] = useState<{
    destination?: SetupDestination;
  } | null>(null);
  const configureSetup: ConfigureSetup = (destination) => {
    setView(
      destination === "tools" || destination === "plugins"
        ? destination
        : "setup"
    );
    setSetupRequest({ destination });
  };
  useEffect(() => {
    if (!setupRequest?.destination || view !== "setup") {
      return;
    }
    const section = document.querySelector(
      `#setup-${setupRequest.destination}`
    );
    section?.scrollIntoView({ block: "start" });
    section
      ?.querySelector<HTMLElement>('input, button, [role="radio"]')
      ?.focus({ preventScroll: true });
  }, [setupRequest, view]);
  const [guest, setGuest] = useState(false);
  const { resolution } = useInstallation();
  const guestEnabled =
    resolution?.selection.plugins.includes("guest-chat") === true;
  if (guest && !guestEnabled) {
    setGuest(false);
  }
  return (
    <Tabs
      value={view}
      onValueChange={setView}
      className="chatjs-create-shell group/layout bg-background text-foreground relative z-10 flex h-svh min-h-0 flex-col gap-0 overflow-hidden"
      data-slot="layout"
    >
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b px-4 py-3 md:px-6">
        <div className="mr-auto flex items-center gap-2.5 lg:flex-1">
          <Brand className="inline-flex items-center gap-2.5 font-semibold tracking-tight" />
          <span className="text-muted-foreground text-sm">/ Create</span>
        </div>
        <TabsList
          aria-label="Create workspace"
          className="order-last w-full lg:order-none lg:w-[26rem]"
        >
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="plugins">Plugins</TabsTrigger>
          <TabsTrigger value="tools">AI tools</TabsTrigger>
          <TabsTrigger value="setup">Setup</TabsTrigger>
        </TabsList>
        <div className="flex items-center justify-end gap-2 lg:flex-1">
          <ModeSwitcher />
          <section aria-label="Installation status" className="md:hidden">
            <InstallationRequirements
              compact
              onConfigureSetup={configureSetup}
            />
          </section>
          <ShareButton />
          <ProjectForm onConfigureSetup={configureSetup} />
        </div>
      </header>
      <main
        className={
          view === "setup"
            ? "hidden"
            : "section-soft relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden [--customizer-width:--spacing(80)] [--gap:--spacing(4)] md:[--gap:--spacing(6)]"
        }
      >
        <div className="flex min-h-11 shrink-0 items-center justify-between gap-3 px-4 py-2 md:px-6">
          <span className="text-muted-foreground hidden min-w-0 text-xs md:block">
            Choose your look and capabilities. Try them live, then get the code.
          </span>
          <div className="flex w-full items-center justify-end gap-2 md:w-auto">
            <HistoryButtons />
            <div className="bg-border mx-1 h-4 w-px" />
            <Button
              aria-label="Desktop preview"
              aria-pressed={params.size === 100}
              variant="ghost"
              size="icon"
              onClick={() => {
                void setParams({ size: 100 });
              }}
            >
              <Monitor className="size-4" />
            </Button>
            <Button
              aria-label="Mobile preview"
              aria-pressed={params.size !== 100}
              variant="ghost"
              size="icon"
              onClick={() => {
                void setParams({ size: 390 });
              }}
            >
              <Smartphone className="size-4" />
            </Button>
          </div>
        </div>
        <div
          data-slot="designer"
          className="flex min-h-0 flex-1 flex-col gap-(--gap) p-(--gap) pt-[calc(var(--gap)*0.25)] md:flex-row-reverse"
        >
          <PreviewOverrideProvider>
            {(params.base === "base" || params.base === "radix") &&
            params.template === "next" ? (
              <Preview
                guestEnabled={guestEnabled}
                guest={guest && guestEnabled}
                onGuestChange={setGuest}
              />
            ) : (
              <div
                role="alert"
                className="flex flex-1 flex-col items-center justify-center gap-4 rounded-2xl border p-6 text-center"
              >
                <h1 className="text-xl font-semibold">
                  This setup is not available yet.
                </h1>
                <p>This preview uses Next.js and Base UI.</p>
                <Button
                  onClick={() => {
                    void setParams({ base: "base", template: "next" });
                  }}
                >
                  Use Base UI and Next.js
                </Button>
              </div>
            )}
            <aside
              aria-label="App configuration"
              className="flex min-h-0 w-full shrink-0 flex-col gap-3 md:h-full md:w-(--customizer-width)"
            >
              <TabsContent
                keepMounted
                value="appearance"
                className={
                  view === "appearance"
                    ? "flex min-h-0 flex-none flex-col overflow-hidden md:flex-1"
                    : "hidden"
                }
              >
                <Customizer itemsByBase={itemsByBase} />
              </TabsContent>
              <TabsContent
                keepMounted
                value="plugins"
                className={
                  view === "plugins"
                    ? "h-[min(22rem,42svh)] min-h-0 flex-none overflow-hidden md:h-auto md:flex-1"
                    : "hidden"
                }
              >
                <InstallationPanel onConfigureSetup={configureSetup} />
              </TabsContent>
              <TabsContent
                keepMounted
                value="tools"
                className={
                  view === "tools"
                    ? "h-[min(22rem,42svh)] min-h-0 flex-none overflow-hidden md:h-auto md:flex-1"
                    : "hidden"
                }
              >
                <ToolsConfiguration
                  onConfigureSetup={configureSetup}
                  onPreviewTools={() => {
                    setGuest(false);
                    void setParams({ item: "preview-tools" });
                  }}
                />
              </TabsContent>
              <section
                aria-label="Installation status"
                className="hidden shrink-0 md:block"
              >
                <InstallationRequirements onConfigureSetup={configureSetup} />
              </section>
            </aside>
          </PreviewOverrideProvider>
        </div>
      </main>
      <TabsContent
        keepMounted
        value="setup"
        className={view === "setup" ? "min-h-0 overflow-hidden" : "hidden"}
      >
        <SetupConfiguration
          installAction={<ProjectForm onConfigureSetup={configureSetup} />}
        />
      </TabsContent>
      <PresetHandler />
    </Tabs>
  );
};

export const CreateConfigurator = ({
  catalog,
}: Readonly<{
  catalog: readonly InstallationCatalogItem[];
}>) => (
  <Suspense fallback={<CreateSkeleton />}>
    <LocksProvider>
      <HistoryProvider>
        <InstallationProvider catalog={catalog}>
          <CreateWorkspace />
        </InstallationProvider>
      </HistoryProvider>
    </LocksProvider>
  </Suspense>
);
