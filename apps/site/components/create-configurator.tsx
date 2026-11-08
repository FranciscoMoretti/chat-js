"use client";

import { Suspense, useState } from "react";
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
import { StackConfiguration } from "./create-preview/stack-configuration";
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

const CreateWorkspace = () => {
  const [params, setParams] = useDesignSystemSearchParams();
  const [view, setView] = useState("app");
  return (
    <Tabs
      value={view}
      onValueChange={setView}
      className="chatjs-create-shell group/layout bg-background text-foreground relative z-10 flex h-svh min-h-0 flex-col gap-0 overflow-hidden"
      data-slot="layout"
    >
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b px-4 py-3 md:px-6">
        <Link
          className="mr-auto font-semibold tracking-tight sm:flex-1"
          href="/"
        >
          ChatJS{" "}
          <span className="text-muted-foreground font-normal">/ Create</span>
        </Link>
        <TabsList
          aria-label="Create workspace"
          className="order-last w-full sm:order-none sm:w-64"
        >
          <TabsTrigger value="app">App</TabsTrigger>
          <TabsTrigger value="stack">Stack</TabsTrigger>
        </TabsList>
        <div className="flex items-center justify-end gap-2 sm:flex-1">
          <ModeSwitcher />
          <ShareButton />
          <ProjectForm />
        </div>
      </header>
      <TabsContent
        keepMounted
        value="app"
        className={view === "app" ? "min-h-0 overflow-hidden" : "hidden"}
      >
        <main className="section-soft relative z-10 flex h-full min-h-0 flex-1 flex-col overflow-hidden [--customizer-width:--spacing(80)] [--gap:--spacing(4)] md:[--gap:--spacing(6)]">
          <div className="flex h-11 shrink-0 items-center justify-between px-4 md:px-6">
            <span className="text-muted-foreground text-xs">
              Customize your app
            </span>
            <div className="flex items-center gap-2">
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
                defaultValue="appearance"
                className="h-[46svh] min-h-0 w-full shrink-0 md:h-full md:w-(--customizer-width)"
                aria-label="Create configuration"
              >
                <TabsList
                  aria-label="Configuration category"
                  className="w-full shrink-0"
                >
                  <TabsTrigger value="appearance">Appearance</TabsTrigger>
                  <TabsTrigger value="features">Plugins</TabsTrigger>
                </TabsList>
                <TabsContent
                  value="appearance"
                  className="min-h-0 overflow-hidden md:flex md:flex-col"
                >
                  <Customizer itemsByBase={itemsByBase} />
                </TabsContent>
                <TabsContent
                  value="features"
                  className="min-h-0 overflow-hidden"
                >
                  <InstallationPanel
                    onConfigureStack={() => {
                      setView("stack");
                    }}
                  />
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
        </main>
      </TabsContent>
      <TabsContent
        keepMounted
        value="stack"
        className={view === "stack" ? "min-h-0 overflow-hidden" : "hidden"}
      >
        <StackConfiguration
          onApp={() => {
            setView("app");
          }}
          onPreviewTools={() => {
            void setParams({ item: "preview-tools" });
            setView("app");
          }}
          installAction={<ProjectForm />}
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
