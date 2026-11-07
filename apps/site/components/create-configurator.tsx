"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
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
import { InstallationProvider } from "./create-preview/installation-provider";
import type { InstallationCatalogItem } from "../../../packages/registry/installation-catalog";
import { InstallationPanel } from "./create-preview/installation-panel";
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
    title: "Tool states",
    type: "registry:block" as const,
  },
];
const itemsByBase = { base: previewItems, radix: previewItems };

const CreateDesigner = () => {
  const [params, setParams] = useDesignSystemSearchParams();
  return (
    <div
      className="chatjs-create-shell group/layout bg-background text-foreground relative z-10 flex h-svh min-h-0 flex-col overflow-hidden"
      data-slot="layout"
    >
      <header className="flex h-14 shrink-0 items-center gap-2 px-4 md:h-16 md:px-6">
        <Link className="mr-auto font-semibold tracking-tight" href="/">
          ChatJS{" "}
          <span className="text-muted-foreground font-normal">/ Create</span>
        </Link>
        <div className="hidden sm:flex">
          <HistoryButtons />
        </div>
        <div className="hidden items-center gap-1 md:flex">
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
        <ModeSwitcher />
        <ShareButton />
        <ProjectForm />
      </header>
      <main className="section-soft relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden [--customizer-width:--spacing(80)] [--gap:--spacing(4)] md:[--gap:--spacing(6)]">
        <div
          data-slot="designer"
          className="flex min-h-0 flex-1 flex-col gap-(--gap) p-(--gap) pt-[calc(var(--gap)*0.25)] md:flex-row-reverse"
        >
          <PreviewOverrideProvider>
            {(params.base === "base" || params.base === "radix") &&
            params.template === "next" ? (
              <Preview />
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
            <Tabs
              defaultValue="app"
              className="h-[46svh] min-h-0 w-full shrink-0 md:h-full md:w-(--customizer-width)"
              aria-label="Create configuration"
            >
              <TabsList
                aria-label="Configuration category"
                className="w-full shrink-0"
              >
                <TabsTrigger value="app">App</TabsTrigger>
                <TabsTrigger value="appearance">Appearance</TabsTrigger>
              </TabsList>
              <TabsContent
                value="appearance"
                className="min-h-0 overflow-hidden md:flex md:flex-col"
              >
                <Customizer itemsByBase={itemsByBase} />
              </TabsContent>
              <TabsContent value="app" className="min-h-0 overflow-hidden">
                <InstallationPanel />
              </TabsContent>
              <section
                aria-label="Create app"
                className="bg-card grid shrink-0 rounded-2xl border p-3"
              >
                <ProjectForm />
              </section>
            </Tabs>
          </PreviewOverrideProvider>
        </div>
        <PresetHandler />
      </main>
    </div>
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
          <CreateDesigner />
        </InstallationProvider>
      </HistoryProvider>
    </LocksProvider>
  </Suspense>
);
