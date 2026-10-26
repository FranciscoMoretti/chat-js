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
import type { CreateProvider } from "./create-model";

const ProjectForm = dynamic(
  async () => {
    const imported = await import("@/components/create-preview/project-form");
    return imported.ProjectForm;
  },
  { ssr: false }
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
      <main className="section-soft relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden [--customizer-width:--spacing(48)] [--gap:--spacing(4)] md:[--gap:--spacing(6)] 2xl:[--customizer-width:--spacing(56)]">
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
                <p>ChatJS creates a Next.js app with Base UI or Radix.</p>
                <Button
                  onClick={() => {
                    void setParams({ base: "base", template: "next" });
                  }}
                >
                  Use Base UI and Next.js
                </Button>
              </div>
            )}
            <Customizer itemsByBase={itemsByBase} />
          </PreviewOverrideProvider>
        </div>
        <PresetHandler />
      </main>
    </div>
  );
};

export const CreateConfigurator = ({
  gateways,
  storageProviders,
}: Readonly<{
  gateways: readonly CreateProvider[];
  storageProviders: readonly CreateProvider[];
}>) => (
  <Suspense fallback={<CreateSkeleton />}>
    <LocksProvider>
      <HistoryProvider>
        <InstallationProvider
          gateways={gateways}
          storageProviders={storageProviders}
        >
          <CreateDesigner />
        </InstallationProvider>
      </HistoryProvider>
    </LocksProvider>
  </Suspense>
);
