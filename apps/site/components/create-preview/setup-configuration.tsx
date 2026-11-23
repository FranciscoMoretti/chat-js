"use client";

import { SetupTile, setupTileGrid, setupTileControl } from "./setup-tile";
import { SetupProviderMark } from "./setup-provider-mark";
import { ConfigurationSection as Section } from "./configuration-section";
import { useState } from "react";
import { Boxes, Cpu, Monitor, ClipboardList } from "lucide-react";
import { CategoryNavigation, categoryLayout } from "./category-navigation";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
} from "@/vendor/shadcn-create/styles/base-nova/ui/popover";
import type { ConfigureSetup } from "./setup-guidance";
import { Button } from "@/vendor/shadcn-create/styles/base-nova/ui/button";
import { Input } from "@/vendor/shadcn-create/styles/base-nova/ui/input";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/vendor/shadcn-create/styles/base-nova/ui/radio-group";
import {
  Field,
  FieldLabel,
} from "@/vendor/shadcn-create/styles/base-nova/ui/field";
import { useInstallation } from "./installation-provider";
import { FeatureChoices } from "./installation-choices";
import { choicesInGroup, setupPluginGroups } from "./catalog-groups";
import {
  InstallationRequirements,
  InvalidInstallation,
} from "./installation-panel";

const providers = [
  {
    kind: "gateway",
    title: "Model gateway",
    description: "Choose how your app connects to AI models.",
  },
  {
    kind: "storage",
    title: "File storage",
    description: "Choose where attachments and generated files will live.",
  },
] as const;

const providerCaptions: Readonly<Record<string, string>> = {
  vercel: "Managed platform",
  openai: "Direct API",
  "openai-compatible": "Custom endpoint",
  openrouter: "Model routing",
  litellm: "Proxy gateway",
  "vercel-blob": "Managed storage",
  s3: "Object storage",
  r2: "S3-compatible",
  memory: "Temporary files",
};

const [gateway, ...infrastructure] = providers;

const ProviderChoices = ({
  kind,
  title,
}: {
  readonly kind: "gateway" | "storage";
  readonly title: string;
}) => {
  const { catalog, installation, resolution, update } = useInstallation();
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  if (!installation) {
    return null;
  }
  const choices = catalog
    .filter((item) => item.definition?.kind === kind)
    .map((item) => ({
      value: item.definition?.id ?? item.name,
      label: item.title,
      description: item.description,
    }));
  const selected = resolution?.selection ?? installation;
  const value =
    (kind === "storage" ? selected.storage?.source : selected[kind]) ??
    (kind === "gateway" ? "" : "memory");
  const selectedDescription = choices.find(
    (choice) => choice.value === value
  )?.description;
  // A compact starting set is presentation only; every catalog provider remains selectable.
  const commonStorage = ["memory", "vercel-blob", "s3", "r2"];
  const hasMore = kind === "storage" && choices.length > commonStorage.length;
  const visibleChoices = choices.filter((choice) => {
    if (hasMore && !expanded) {
      return commonStorage.includes(choice.value) || choice.value === value;
    }
    return `${choice.label} ${choice.description}`
      .toLowerCase()
      .includes(query.toLowerCase());
  });
  return (
    <div>
      {hasMore && expanded && (
        <Input
          aria-label="Search storage providers"
          placeholder="Search storage providers…"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
          className="mb-4"
        />
      )}
      <RadioGroup
        aria-label={title}
        value={value}
        className={setupTileGrid}
        onValueChange={(next) => {
          if (typeof next !== "string" || next === value) {
            return;
          }
          const provider =
            kind === "storage" && next === "memory" ? undefined : next;
          update({
            ...installation,
            [kind]:
              kind === "storage" && provider !== undefined
                ? { source: provider, options: {} }
                : provider,
          });
        }}
      >
        {visibleChoices.map((choice) => (
          <SetupTile
            key={choice.value}
            title={choice.label}
            caption={providerCaptions[choice.value] ?? title}
            controlId={`${kind}-${choice.value}`}
            visual={<SetupProviderMark id={choice.value} />}
            control={
              <RadioGroupItem
                id={`${kind}-${choice.value}`}
                value={choice.value}
                aria-label={choice.label}
                className={setupTileControl}
              />
            }
          />
        ))}
      </RadioGroup>
      {selectedDescription !== undefined && selectedDescription !== "" && (
        <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
          {selectedDescription}
        </p>
      )}
      {visibleChoices.length === 0 && (
        <output className="text-muted-foreground block py-6 text-center text-sm">
          No providers match “{query}”.
        </output>
      )}
      {hasMore && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-3"
          onClick={() => {
            setExpanded(!expanded);
            setQuery("");
          }}
        >
          {expanded
            ? "Show fewer providers"
            : `Show all ${choices.length} providers`}
        </Button>
      )}
    </div>
  );
};

const StorageOptions = () => {
  const { catalog, installation, resolution, update } = useInstallation();
  const storage = catalog.find(
    (item) =>
      item.definition?.kind === "storage" &&
      item.definition.id === resolution?.selection.storage?.source
  )?.definition;
  if (
    !installation ||
    storage?.kind !== "storage" ||
    storage.configKeys.length === 0
  ) {
    return null;
  }
  return (
    <div className="bg-muted/30 mt-4 rounded-xl border p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {storage.configKeys.map((key) => (
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
      </div>
      <p className="text-muted-foreground mt-3 text-xs">
        Public configuration only. Add credentials in your app’s environment
        after installation.
      </p>
    </div>
  );
};

const setupSections = [
  { id: "gateway", title: "Models & Gateways", Icon: Cpu },
  { id: "infrastructure", title: "Infrastructure", Icon: Boxes },
  ...setupPluginGroups.map((group) => ({
    ...group,
    Icon: Monitor,
  })),
];

export const SetupConfiguration = () => {
  const { catalog, installation, resolution } = useInstallation();
  return (
    <div
      className="h-full overflow-y-auto overscroll-contain"
      data-testid="setup-scroll"
    >
      <div className="mx-auto max-w-6xl space-y-8 px-5 py-6 sm:px-8 sm:py-10">
        <h1 className="text-2xl font-semibold tracking-tight">
          Set up your app.
        </h1>
        {installation && resolution ? (
          <div className={categoryLayout}>
            <CategoryNavigation
              label="Setup sections"
              prefix="setup"
              sections={setupSections.map(({ id, title, Icon }) => ({
                id,
                title,
                icon: <Icon aria-hidden="true" className="size-3.5 shrink-0" />,
              }))}
            />
            <div className="min-w-0">
              <div className="space-y-7 [&>section]:scroll-mt-20 [&>section]:lg:scroll-mt-6">
                <Section
                  id="gateway"
                  title="Models & Gateways"
                  icon={<Cpu aria-hidden="true" className="size-4 shrink-0" />}
                  description={gateway.description}
                >
                  <ProviderChoices kind={gateway.kind} title={gateway.title} />
                </Section>
                <Section
                  id="infrastructure"
                  title="Infrastructure"
                  icon={
                    <Boxes aria-hidden="true" className="size-4 shrink-0" />
                  }
                  description="Choose services for the capabilities you selected."
                >
                  <div className="space-y-6">
                    {infrastructure.map(({ kind, title, description }) => (
                      <div
                        key={kind}
                        id={`setup-${kind}`}
                        className="scroll-mt-20 lg:scroll-mt-6"
                      >
                        <h3 className="text-sm font-medium">{title}</h3>
                        <p className="text-muted-foreground mt-1 mb-3 text-sm">
                          {description}
                        </p>
                        <ProviderChoices kind={kind} title={title} />
                        {kind === "storage" && <StorageOptions />}
                      </div>
                    ))}
                  </div>
                </Section>
                {setupPluginGroups.map(({ id, title, description, ids }) => (
                  <Section
                    key={id}
                    id={id}
                    title={title}
                    description={description}
                    icon={
                      <Monitor aria-hidden="true" className="size-4 shrink-0" />
                    }
                  >
                    <FeatureChoices
                      items={choicesInGroup(
                        catalog.filter(
                          (item) => item.definition?.kind === "plugin"
                        ),
                        ids
                      )}
                      cards
                    />
                  </Section>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <InvalidInstallation />
        )}
      </div>
    </div>
  );
};

export const SetupSummary = ({
  onConfigureSetup,
}: {
  readonly onConfigureSetup: ConfigureSetup;
}) => {
  const { catalog, installation, resolution } = useInstallation();
  const [open, setOpen] = useState(false);
  if (!installation || !resolution) {
    return null;
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={<Button variant="outline" size="sm" />}
        aria-label="Your app summary"
      >
        <ClipboardList aria-hidden="true" className="size-4" />
        <span className="hidden sm:inline">Your app</span>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="max-h-[calc(100svh-8rem)] w-72 max-w-[calc(100vw-2rem)] overflow-y-auto overscroll-contain p-4 motion-reduce:animate-none!"
      >
        <aside aria-label="Your app summary" className="flex flex-col gap-4">
          <PopoverHeader>
            <PopoverTitle>Your app</PopoverTitle>
          </PopoverHeader>
          <dl className="space-y-4 text-sm">
            {providers.map(({ kind, title }) => {
              const source =
                kind === "storage"
                  ? (resolution.selection.storage?.source ?? "memory")
                  : resolution.selection[kind];
              const item = catalog.find(
                (entry) =>
                  entry.definition?.kind === kind &&
                  entry.definition.id === source
              );
              return (
                <div key={kind}>
                  <dt className="text-muted-foreground text-xs">{title}</dt>
                  <dd className="mt-1 truncate font-medium">
                    {item?.title ??
                      (kind === "gateway" ? "Choose a gateway" : "None")}
                  </dd>
                </div>
              );
            })}
            <div className="flex items-center justify-between border-t pt-4">
              <dt>Plugins</dt>
              <dd className="tabular-nums">
                {resolution.selection.plugins.length}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt>Tools</dt>
              <dd className="tabular-nums">
                {resolution.selection.tools.length}
              </dd>
            </div>
          </dl>
          <div className="-mx-2">
            <InstallationRequirements
              onConfigureSetup={(destination) => {
                setOpen(false);
                onConfigureSetup(destination);
              }}
            />
          </div>
        </aside>
      </PopoverContent>
    </Popover>
  );
};
