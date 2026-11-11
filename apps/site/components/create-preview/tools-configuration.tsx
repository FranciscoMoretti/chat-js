"use client";

import type { ConfigureSetup } from "./setup-guidance";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/vendor/shadcn-create/styles/base-nova/ui/button";
import { ScrollArea } from "@/vendor/shadcn-create/styles/base-nova/ui/scroll-area";
import { useInstallation } from "./installation-provider";
import { FeatureChoices } from "./installation-choices";
import { groupTools } from "./catalog-groups";
import { InvalidInstallation } from "./installation-panel";

export const ToolsConfiguration = ({
  onPreviewTools,
  onConfigureSetup,
}: {
  readonly onConfigureSetup: ConfigureSetup;
  readonly onPreviewTools: () => void;
}) => {
  const { catalog, installation } = useInstallation();
  const tools = catalog.filter((item) => item.definition?.kind === "tool");

  return (
    <section
      aria-label="AI tools"
      className="bg-card flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border"
    >
      <div className="space-y-3 border-b p-4">
        <div>
          <h2 className="text-sm font-medium">AI tools</h2>
          <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
            Choose what your assistant can do.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={onPreviewTools}
        >
          Preview tool examples <ArrowUpRight />
        </Button>
      </div>
      <ScrollArea className="min-h-0 flex-1" data-testid="tools-scroll">
        <div className="space-y-5 p-4">
          {installation ? (
            <>
              {groupTools(tools).map(({ title, items }) => (
                <section key={title} aria-label={title}>
                  <h3 className="text-muted-foreground mb-2 text-xs font-medium">
                    {title}
                  </h3>
                  <FeatureChoices
                    items={items}
                    onConfigureSetup={onConfigureSetup}
                  />
                </section>
              ))}
            </>
          ) : (
            <InvalidInstallation />
          )}
        </div>
      </ScrollArea>
    </section>
  );
};
