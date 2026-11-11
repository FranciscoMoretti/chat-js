"use client";

import { setupAction, setupActions } from "./setup-guidance";
import type { ConfigureSetup } from "./setup-guidance";
import Link from "next/link";
import { useState } from "react";
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

export const InstallationRequirements = ({
  onConfigureSetup,
  compact = false,
}: {
  readonly onConfigureSetup?: ConfigureSetup;
  readonly compact?: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const { resolution } = useInstallation();
  const issues = resolution?.issues ?? [];
  const choices = setupActions(issues);
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
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            className={
              compact
                ? "size-8 p-0"
                : "h-auto min-h-15 w-full justify-between py-2 text-start whitespace-normal"
            }
          />
        }
        aria-label="Setup requirements"
      >
        <span className="flex min-w-0 items-center gap-2">
          {issues.length ? <CircleAlert /> : <CircleCheck />}
          <span className={compact ? "sr-only" : "min-w-0"}>
            {issues.length
              ? `Review setup · ${choices.length} ${choices.length === 1 ? "choice" : "choices"} needed`
              : "Ready to install"}
          </span>
        </span>
        {!compact && <Settings2 data-icon="inline-end" />}
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
                      <li key={issue}>
                        <p>{issue}</p>
                        {onConfigureSetup && (
                          <Button
                            variant="link"
                            size="sm"
                            className="h-auto p-0 text-xs"
                            onClick={() => {
                              setOpen(false);
                              onConfigureSetup(setupAction(issue).destination);
                            }}
                          >
                            {setupAction(issue).label}
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">After installation</p>
              <p className="text-muted-foreground text-xs">
                Add credentials to your app’s environment. You don’t need them
                to get the code.
              </p>
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
        {onConfigureSetup && (
          <Button
            onClick={() => {
              setOpen(false);
              onConfigureSetup();
            }}
          >
            Open Setup
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
};

export const InstallationPanel = ({
  onConfigureSetup,
}: {
  readonly onConfigureSetup: ConfigureSetup;
}) => {
  const { catalog, installation } = useInstallation();
  return (
    <section
      aria-label="Configure your app"
      className="bg-card flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border"
    >
      <div className="border-b px-4 py-4">
        <h2 className="text-sm font-medium">Plugins</h2>
        <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
          Choose what people can do in your app.
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
