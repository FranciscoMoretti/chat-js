"use client";

import { CapabilityRow } from "./capability-row";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/vendor/shadcn-create/styles/base-nova/ui/radio-group";
import { AgentCategoryIcon } from "./agent-category-icon";
import { EveCatalog } from "./eve-catalog";
import { Button } from "@/vendor/shadcn-create/styles/base-nova/ui/button";
import { InvalidInstallation } from "./installation-panel";
import { useInstallation } from "./installation-provider";
import type { ConfigureSetup } from "./setup-guidance";
import { setupActions } from "./setup-guidance";

const sandboxVisualIds: Readonly<Record<string, string>> = {
  vercel: "setup/vercel",
  "just-bash": "tool/bash",
};

export const AgentConfiguration = ({
  onConfigureSetup,
}: {
  readonly onConfigureSetup: ConfigureSetup;
}) => {
  const { catalog, installation, resolution, update } = useInstallation();
  if (!installation || !resolution) {
    return <InvalidInstallation />;
  }
  return (
    <div
      className="h-full overflow-y-auto overscroll-contain"
      data-testid="agent-scroll"
    >
      <div className="mx-auto max-w-6xl space-y-8 px-5 py-6 sm:px-8 sm:py-10">
        <h1 className="text-2xl font-semibold tracking-tight">
          Build your agent
        </h1>
        <EveCatalog onAppToolSelectionChange={update}>
          <section
            id="agent-sandbox"
            aria-label="Sandbox"
            className="scroll-mt-20 border-t pt-7 lg:scroll-mt-6"
          >
            <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
              <AgentCategoryIcon category="sandbox" />
              Sandbox
            </h2>
            <RadioGroup
              aria-label="Sandbox"
              className="mt-5 grid gap-3 md:grid-cols-2"
              value={installation.sandbox ?? "default"}
              onValueChange={(value) => {
                if (typeof value === "string") {
                  update({ ...installation, sandbox: value });
                }
              }}
            >
              {catalog
                .filter((item) => item.definition?.kind === "sandbox")
                .map((item) => {
                  const id = item.definition?.id ?? item.name;
                  const controlId = `agent-sandbox-${id}`;
                  return (
                    <CapabilityRow
                      key={id}
                      title={item.title}
                      description={item.description}
                      visualId={sandboxVisualIds[id] ?? `sandbox/${id}`}
                      category="sandbox"
                      source="EVE"
                      docs={
                        id === "default"
                          ? "https://eve.dev/docs/sandbox/default"
                          : undefined
                      }
                      details={
                        id === "default" ? (
                          <div className="space-y-0.5 pt-2">
                            <p className="text-popover-foreground font-medium">
                              Self-hosted production
                            </p>
                            <p>
                              Run Docker during the build, or choose a sandbox
                              provider.
                            </p>
                          </div>
                        ) : undefined
                      }
                      controlId={controlId}
                      checked={(installation.sandbox ?? "default") === id}
                      control={
                        <RadioGroupItem
                          id={controlId}
                          value={id}
                          aria-label={item.title}
                          className="absolute! end-3 top-4 shrink-0"
                        />
                      }
                    />
                  );
                })}
            </RadioGroup>
          </section>
          <div className="flex flex-wrap gap-2">
            {setupActions(resolution.issues).map((action) => (
              <Button
                key={action.destination}
                variant="outline"
                onClick={() => {
                  onConfigureSetup(action.destination);
                }}
              >
                {action.label}
              </Button>
            ))}
          </div>
        </EveCatalog>
      </div>
    </div>
  );
};
