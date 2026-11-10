"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { Button } from "@/vendor/shadcn-create/styles/base-nova/ui/button";
import { Input } from "@/vendor/shadcn-create/styles/base-nova/ui/input";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/vendor/shadcn-create/styles/base-nova/ui/radio-group";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldTitle,
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
  {
    kind: "sandbox",
    title: "Sandbox",
    description: "Give tools an environment to run code and work with files.",
  },
] as const;

const [gateway, ...infrastructure] = providers;

const Section = ({
  id,
  title,
  description,
  children,
  action,
}: {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly children: ReactNode;
  readonly action?: ReactNode;
}) => (
  <section
    id={`setup-${id}`}
    aria-label={title}
    className="scroll-mt-6 border-b pb-9 last:border-0"
  >
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
          {description}
        </p>
      </div>
      {action}
    </div>
    {children}
  </section>
);

const ProviderChoices = ({
  kind,
  title,
}: {
  readonly kind: "gateway" | "storage" | "sandbox";
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
  if (kind !== "gateway") {
    choices.unshift({
      value: "none",
      label: "None",
      description:
        kind === "storage"
          ? "Start without file storage."
          : "Start without a sandbox.",
    });
  }
  const selected = resolution?.selection ?? installation;
  const value =
    (kind === "storage" ? selected.storage?.source : selected[kind]) ??
    (kind === "gateway" ? "" : "none");
  // A compact starting set is presentation only; every catalog provider remains selectable.
  const commonStorage = ["none", "vercel-blob", "s3", "r2"];
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
        className="grid gap-3 sm:grid-cols-2"
        onValueChange={(next) => {
          if (typeof next !== "string" || next === value) {
            return;
          }
          const provider = next === "none" ? undefined : next;
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
          <FieldLabel
            key={choice.value}
            htmlFor={`${kind}-${choice.value}`}
            className="h-full cursor-pointer"
          >
            <Field
              orientation="horizontal"
              className="h-full min-h-22 items-center! gap-4 p-4!"
            >
              <FieldContent className="gap-1.5">
                <FieldTitle>{choice.label}</FieldTitle>
                {choice.description && (
                  <FieldDescription className="text-xs leading-relaxed">
                    {choice.description}
                  </FieldDescription>
                )}
              </FieldContent>
              <RadioGroupItem
                id={`${kind}-${choice.value}`}
                value={choice.value}
                aria-label={choice.label}
              />
            </Field>
          </FieldLabel>
        ))}
      </RadioGroup>
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
            : `Show all ${choices.length - 1} providers`}
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

export const SetupConfiguration = ({
  installAction,
}: {
  readonly installAction: ReactNode;
}) => {
  const { catalog, installation, resolution } = useInstallation();
  const sections = [
    { id: "gateway", title: "Models & Gateways" },
    { id: "infrastructure", title: "Infrastructure" },
    ...setupPluginGroups,
  ];
  return (
    <div className="h-full overflow-y-auto" data-testid="setup-scroll">
      <div className="mx-auto max-w-6xl px-5 py-6 sm:px-8 sm:py-10">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-muted-foreground mb-2 text-xs font-medium">
              YOUR CHATJS APP
            </p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Set up your app.
            </h1>
            <p className="text-muted-foreground mt-3 max-w-xl text-sm leading-relaxed">
              Choose what powers your app. Start with the essentials and add
              what you need.
            </p>
          </div>
        </div>
        {installation && resolution ? (
          <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_16rem] lg:gap-12">
            <div className="min-w-0">
              <nav
                aria-label="Setup sections"
                className="mb-8 flex flex-wrap gap-x-5 gap-y-3 border-y py-4 text-xs"
              >
                {sections.map((section) => (
                  <a
                    key={section.id}
                    href={`#setup-${section.id}`}
                    className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
                  >
                    {section.title}
                  </a>
                ))}
              </nav>
              <div className="space-y-9">
                <Section
                  id="gateway"
                  title="Models & Gateways"
                  description={gateway.description}
                >
                  <ProviderChoices kind={gateway.kind} title={gateway.title} />
                </Section>
                <Section
                  id="infrastructure"
                  title="Infrastructure"
                  description="Choose services for the capabilities you selected."
                >
                  <div className="space-y-6">
                    {infrastructure.map(({ kind, title, description }) => (
                      <div
                        key={kind}
                        id={`setup-${kind}`}
                        className="scroll-mt-6"
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
            <aside
              aria-label="Your app summary"
              className="bg-card top-6 flex flex-col gap-5 rounded-2xl border p-5 lg:sticky"
            >
              <div>
                <h2 className="font-semibold">Your app</h2>
                <p className="text-muted-foreground mt-1 text-xs">
                  One setup, ready to make your own.
                </p>
              </div>
              <dl className="space-y-4 text-sm">
                {providers.map(({ kind, title }) => {
                  const source =
                    kind === "storage"
                      ? resolution.selection.storage?.source
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
                <InstallationRequirements />
              </div>
              {installAction}
              <p className="text-muted-foreground text-xs leading-relaxed">
                Selections stay with you when you switch views or share your
                app.
              </p>
            </aside>
          </div>
        ) : (
          <InvalidInstallation />
        )}
      </div>
    </div>
  );
};
