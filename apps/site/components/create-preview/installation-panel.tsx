"use client";

import { useState } from "react";
import Link from "next/link";
import { CircleCheck, CircleAlert, Settings2 } from "lucide-react";
import { Button } from "@/vendor/shadcn-create/styles/base-nova/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/vendor/shadcn-create/styles/base-nova/ui/card";
import { Badge } from "@/vendor/shadcn-create/styles/base-nova/ui/badge";
import {
  Alert,
  AlertTitle,
  AlertDescription,
} from "@/vendor/shadcn-create/styles/base-nova/ui/alert";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldTitle,
  FieldGroup,
} from "@/vendor/shadcn-create/styles/base-nova/ui/field";
import { Switch } from "@/vendor/shadcn-create/styles/base-nova/ui/switch";
import { Input } from "@/vendor/shadcn-create/styles/base-nova/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
} from "@/vendor/shadcn-create/styles/base-nova/ui/select";
import { ScrollArea } from "@/vendor/shadcn-create/styles/base-nova/ui/scroll-area";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
} from "@/vendor/shadcn-create/styles/base-nova/ui/popover";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/vendor/shadcn-create/styles/base-nova/ui/tabs";
import { useInstallation } from "./installation-provider";
import { pluginPreviewLabel } from "./preview-capabilities";

const FeatureChoices = ({ kind }: Readonly<{ kind: "plugin" | "tool" }>) => {
  const { catalog, installation, resolution, update } = useInstallation();
  if (!installation || !resolution) {
    return null;
  }
  const key = kind === "plugin" ? "plugins" : "tools";
  return (
    <FieldGroup className="gap-2">
      {catalog
        .filter((item) => item.definition?.kind === kind)
        .map((item) => {
          const { definition } = item;
          if (!definition) {
            return null;
          }
          const { id } = definition;
          const selected = resolution.selection[key].includes(id);
          const requiredBy = resolution.reasons[item.name] ?? [];
          const isThisItem = (source: string) =>
            source === id ||
            source === item.name ||
            source === `@chatjs/${item.name}`;
          const explicit = installation[key].some(isThisItem);
          const availability =
            definition.kind === "plugin"
              ? pluginPreviewLabel(id, Boolean(definition.client))
              : "Tool scenes";
          const dependency = requiredBy.length
            ? `Required by ${requiredBy.join(", ")}${explicit ? "; also selected directly" : ""}`
            : "Optional";
          return (
            <FieldLabel key={item.name} htmlFor={`feature-${item.name}`}>
              <Field orientation="horizontal">
                <FieldContent className="min-w-0 gap-2">
                  <FieldTitle>{item.title}</FieldTitle>
                  <FieldDescription>{item.description}</FieldDescription>
                  <div className="flex min-w-0 items-center gap-2">
                    <Badge variant="outline">{availability}</Badge>
                    <span
                      className="text-muted-foreground min-w-0 truncate text-xs font-normal"
                      title={dependency}
                    >
                      {dependency}
                    </span>
                  </div>
                </FieldContent>
                <Switch
                  id={`feature-${item.name}`}
                  className="mt-0.5 shrink-0"
                  aria-label={item.title}
                  checked={selected}
                  disabled={!explicit && requiredBy.length > 0}
                  onCheckedChange={(checked) => {
                    update({
                      ...installation,
                      [key]: checked
                        ? [...installation[key], id]
                        : installation[key].filter(
                            (value) => !isThisItem(value)
                          ),
                    });
                  }}
                />
              </Field>
            </FieldLabel>
          );
        })}
    </FieldGroup>
  );
};

const ProviderChoices = () => {
  const { catalog, installation, update } = useInstallation();
  if (!installation) {
    return null;
  }
  const storage = catalog.find(
    (item) =>
      item.definition?.kind === "storage" &&
      item.definition.id === installation.storage?.source
  )?.definition;
  return (
    <FieldGroup>
      {(["gateway", "storage", "sandbox"] as const).map((kind) => {
        const choices = catalog
          .filter((item) => item.definition?.kind === kind)
          .map((item) => ({
            value: item.definition?.id ?? item.name,
            label: item.title,
          }));
        if (kind === "sandbox") {
          choices.unshift({ value: "none", label: "None" });
        }
        const value =
          (kind === "storage"
            ? installation.storage?.source
            : installation[kind]) ?? (kind === "sandbox" ? "none" : null);
        return (
          <Field key={kind}>
            <FieldLabel htmlFor={`chatjs-${kind}`}>
              {
                {
                  gateway: "Model gateway",
                  storage: "Storage provider",
                  sandbox: "Sandbox provider",
                }[kind]
              }
            </FieldLabel>
            <Select
              items={choices}
              value={value}
              modal={false}
              onValueChange={(next) => {
                if (next === null) {
                  return;
                }
                const provider = next === "none" ? undefined : next;
                update({
                  ...installation,
                  [kind]:
                    kind === "storage"
                      ? { source: next, options: {} }
                      : provider,
                });
              }}
            >
              <SelectTrigger id={`chatjs-${kind}`} className="w-full">
                <SelectValue placeholder="Choose a provider" />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                <SelectGroup>
                  {choices.map((choice) => (
                    <SelectItem key={choice.value} value={choice.value}>
                      {choice.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        );
      })}
      {storage?.kind === "storage" &&
        storage.configKeys.map((key) => (
          <Field key={key}>
            <FieldLabel htmlFor={`storage-${key}`}>Storage {key}</FieldLabel>
            <Input
              id={`storage-${key}`}
              value={
                typeof installation.storage?.options[key] === "string"
                  ? installation.storage.options[key]
                  : ""
              }
              onChange={(event) => {
                update({
                  ...installation,
                  storage: {
                    source: storage.id,
                    options: {
                      ...installation.storage?.options,
                      [key]: event.target.value,
                    },
                  },
                });
              }}
            />
          </Field>
        ))}
      <FieldDescription>
        Public configuration only. Add credentials to your generated app’s
        environment.
      </FieldDescription>
    </FieldGroup>
  );
};

const InstallationRequirements = () => {
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

export const InstallationPanel = () => {
  const { installation } = useInstallation();
  const [tab, setTab] = useState("plugins");
  return (
    <section aria-label="Configure your app" className="h-full min-h-0">
      <Card size="sm" className="h-full min-h-0 gap-3 rounded-2xl">
        <CardHeader>
          <CardTitle>Build your app</CardTitle>
          <CardDescription>
            Choose the features behind your design.
          </CardDescription>
        </CardHeader>
        {installation ? (
          <>
            <Tabs
              value={tab}
              onValueChange={setTab}
              className="min-h-0 flex-1 gap-3"
            >
              <div className="px-3">
                <TabsList
                  aria-label="App configuration"
                  variant="line"
                  className="w-full shrink-0"
                >
                  <TabsTrigger value="plugins">Plugins</TabsTrigger>
                  <TabsTrigger value="tools">Tools</TabsTrigger>
                  <TabsTrigger value="providers">Providers</TabsTrigger>
                </TabsList>
              </div>
              <ScrollArea key={tab} className="min-h-0 flex-1">
                <CardContent className="pb-3">
                  <TabsContent value="plugins">
                    <FeatureChoices kind="plugin" />
                  </TabsContent>
                  <TabsContent value="tools">
                    <FeatureChoices kind="tool" />
                  </TabsContent>
                  <TabsContent value="providers">
                    <ProviderChoices />
                  </TabsContent>
                </CardContent>
              </ScrollArea>
            </Tabs>
            <CardFooter className="h-12 shrink-0 p-2">
              <InstallationRequirements />
            </CardFooter>
          </>
        ) : (
          <CardContent>
            <Alert variant="destructive">
              <AlertTitle>Invalid installation options</AlertTitle>
              <AlertDescription>
                <Link href="/create" className="underline">
                  Start a new setup
                </Link>
              </AlertDescription>
            </Alert>
          </CardContent>
        )}
      </Card>
    </section>
  );
};
