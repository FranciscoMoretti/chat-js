"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { ArrowLeft, ArrowUpRight, Search } from "lucide-react";
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
import { FeatureChoices, featureSection } from "./installation-choices";
import {
  InstallationRequirements,
  InvalidInstallation,
} from "./installation-panel";

const providerSections = [
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
    id={`stack-${id}`}
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

export const StackConfiguration = ({
  onApp,
  onPreviewTools,
  installAction,
}: {
  readonly onApp: () => void;
  readonly onPreviewTools: () => void;
  readonly installAction: ReactNode;
}) => {
  const { catalog, installation, resolution } = useInstallation();
  const [query, setQuery] = useState("");
  const tools = catalog.filter((item) => featureSection(item) === "AI tools");
  const filteredTools = tools.filter((item) =>
    `${item.title} ${item.description}`
      .toLowerCase()
      .includes(query.toLowerCase())
  );
  const sections = [
    ...providerSections.map((section) => ({
      id: section.kind,
      title: section.title,
    })),
    { id: "tools", title: "AI tools" },
    { id: "observability", title: "Observability" },
    { id: "platforms", title: "Platforms" },
  ];
  return (
    <div className="h-full overflow-y-auto" data-testid="stack-scroll">
      <div className="mx-auto max-w-6xl px-5 py-6 sm:px-8 sm:py-10">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-muted-foreground mb-2 text-xs font-medium">
              YOUR CHATJS APP
            </p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Configure your stack.
            </h1>
            <p className="text-muted-foreground mt-3 max-w-xl text-sm leading-relaxed">
              Choose what powers your app. Start with the essentials and add
              what you need.
            </p>
          </div>
          <Button variant="outline" onClick={onApp}>
            <ArrowLeft /> Back to app
          </Button>
        </div>
        {installation && resolution ? (
          <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_16rem] lg:gap-12">
            <div className="min-w-0">
              <nav
                aria-label="Stack sections"
                className="mb-8 flex flex-wrap gap-x-5 gap-y-3 border-y py-4 text-xs"
              >
                {sections.map((section) => (
                  <a
                    key={section.id}
                    href={`#stack-${section.id}`}
                    className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
                  >
                    {section.title}
                  </a>
                ))}
              </nav>
              <div className="space-y-9">
                {providerSections.map(({ kind, title, description }) => (
                  <Section
                    key={kind}
                    id={kind}
                    title={title}
                    description={description}
                  >
                    <ProviderChoices kind={kind} title={title} />
                    {kind === "storage" && <StorageOptions />}
                  </Section>
                ))}
                <Section
                  id="tools"
                  title="AI tools"
                  description="Add capabilities your assistant can use during a conversation."
                  action={
                    <Button variant="ghost" size="sm" onClick={onPreviewTools}>
                      Preview tools <ArrowUpRight />
                    </Button>
                  }
                >
                  <div className="relative mb-4">
                    <Search className="text-muted-foreground absolute top-2.5 left-3 size-4" />
                    <Input
                      aria-label="Search tools"
                      placeholder="Search tools…"
                      value={query}
                      onChange={(event) => {
                        setQuery(event.target.value);
                      }}
                      className="pl-9"
                    />
                  </div>
                  <FeatureChoices items={filteredTools} cards />
                  {filteredTools.length === 0 && (
                    <output className="text-muted-foreground py-6 text-center text-sm">
                      No tools match “{query}”.
                    </output>
                  )}
                </Section>
                <Section
                  id="observability"
                  title="Observability"
                  description="Understand traffic, app performance and AI activity."
                >
                  <FeatureChoices
                    items={catalog.filter(
                      (item) => featureSection(item) === "Observability"
                    )}
                    cards
                  />
                </Section>
                <Section
                  id="platforms"
                  title="Platforms"
                  description="Your app runs on the web. Add another way to use it."
                >
                  <FeatureChoices
                    items={catalog.filter(
                      (item) => featureSection(item) === "Platforms"
                    )}
                    cards
                  />
                </Section>
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
                {providerSections.map(({ kind, title }) => {
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
                  <dt>Features & integrations</dt>
                  <dd className="tabular-nums">
                    {resolution.selection.plugins.length}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt>AI tools</dt>
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
