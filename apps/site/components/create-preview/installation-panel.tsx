"use client";

import Link from "next/link";
import { CircleCheck, CircleAlert, Settings2 } from "lucide-react";
import { Button } from "@/vendor/shadcn-create/styles/base-nova/ui/button";
import {
  Alert,
  AlertTitle,
  AlertDescription,
} from "@/vendor/shadcn-create/styles/base-nova/ui/alert";
import { ScrollArea } from "@/vendor/shadcn-create/styles/base-nova/ui/scroll-area";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
} from "@/vendor/shadcn-create/styles/base-nova/ui/popover";
import { useInstallation } from "./installation-provider";
import { FeatureChoices } from "./installation-choices";
import { groupAppPlugins } from "./catalog-groups";

export const InvalidInstallation = () => (
  <Alert variant="destructive">
    <AlertTitle>Invalid installation options</AlertTitle>
    <AlertDescription>
      <Link href="/create" className="underline">
        Start a new setup
      </Link>
    </AlertDescription>
  </Alert>
);

export const InstallationRequirements = () => {
  const { resolution } = useInstallation();
  const issues = resolution?.issues ?? [];
  const requirements = [
    ...new Set(
      resolution?.items.flatMap(
        (item) =>
          item.definition?.envRequirements?.map((requirement) =>
            requirement.options.map((option) => option.join(" + ")).join(" or ")
          ) ?? []
      )
    ),
  ];
  return (
    <Popover>
      <PopoverTrigger
        render={<Button variant="ghost" className="w-full justify-between" />}
        aria-label="Setup requirements"
      >
        <span className="flex items-center gap-2">
          {issues.length ? <CircleAlert /> : <CircleCheck />}
          {issues.length ? "Setup needed" : "Ready to install"}
        </span>
        <Settings2 data-icon="inline-end" />
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        className="w-80 max-w-[calc(100vw-2rem)]"
      >
        <PopoverHeader>
          <PopoverTitle>Setup requirements</PopoverTitle>
          <PopoverDescription>
            Selections are saved in your link and install command.
          </PopoverDescription>
        </PopoverHeader>
        <ScrollArea className="max-h-72 overflow-y-auto">
          <div className="flex flex-col gap-4">
            {issues.length > 0 && (
              <Alert variant="destructive">
                <AlertTitle>Complete your setup</AlertTitle>
                <AlertDescription>
                  <ul
                    aria-label="Installation issues"
                    className="list-disc pl-4"
                  >
                    {issues.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">Environment variables</p>
              {requirements.length ? (
                <ul className="text-muted-foreground flex list-disc flex-col gap-1 pl-4 text-xs break-words">
                  {requirements.map((requirement) => (
                    <li key={requirement}>{requirement}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground text-sm">
                  No additional credentials required.
                </p>
              )}
            </div>
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export const InstallationPanel = ({
  onConfigureStack,
}: {
  readonly onConfigureStack: () => void;
}) => {
  const { catalog, installation } = useInstallation();
  return (
    <section
      aria-label="Configure your app"
      className="bg-card flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border"
    >
      <div className="border-b px-4 py-4">
        <h2 className="text-sm font-medium">Make it yours</h2>
        <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
          Choose what your chat can do.
        </p>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-5 p-4">
          {installation ? (
            <>
              {groupAppPlugins(catalog).map(({ title, items }) => (
                <section key={title} aria-label={title}>
                  <h3 className="text-muted-foreground mb-2 text-xs font-medium">
                    {title}
                  </h3>
                  <FeatureChoices items={items} />
                </section>
              ))}
              <div className="border-t pt-4">
                <p className="text-muted-foreground mb-3 text-xs leading-relaxed">
                  Choose tools, gateways and infrastructure in your stack.
                </p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={onConfigureStack}
                >
                  Configure stack <Settings2 />
                </Button>
              </div>
            </>
          ) : (
            <InvalidInstallation />
          )}
        </div>
      </ScrollArea>
      <div className="shrink-0 border-t p-2">
        <InstallationRequirements />
      </div>
    </section>
  );
};
