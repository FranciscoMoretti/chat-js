"use client";

// ChatJS adaptation of upstream ProjectForm. Native dialog, field/toggle/tabs
// structure is retained; ChatJS's existing installation selection replaces the
// upstream framework/template choices because ChatJS owns its Next.js scaffold.
import * as React from "react";
import Link from "next/link";
import { Copy01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "cn";
import { decodePreset } from "shadcn/preset";
import { copyToClipboardWithMeta } from "@/components/create-preview/copy-clipboard";
import { createCommand } from "@/components/create-model";
import { useInstallation } from "@/components/create-preview/installation-provider";
import {
  BASES,
  buildThemeForPreset,
  DEFAULT_CONFIG,
} from "@/vendor/shadcn-create/registry/config";
import { Button } from "@/vendor/shadcn-create/styles/base-nova/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/vendor/shadcn-create/styles/base-nova/ui/dialog";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/vendor/shadcn-create/styles/base-nova/ui/field";
import { Input } from "@/vendor/shadcn-create/styles/base-nova/ui/input";
import { Switch } from "@/vendor/shadcn-create/styles/base-nova/ui/switch";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/vendor/shadcn-create/styles/base-nova/ui/radio-group";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/vendor/shadcn-create/styles/base-nova/ui/tabs";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/vendor/shadcn-create/styles/base-nova/ui/toggle-group";
import { usePresetCode } from "@/vendor/shadcn-create/hooks/use-design-system";
import { useDesignSystemSearchParams } from "@/vendor/shadcn-create/lib/search-params";

const PACKAGE_MANAGERS = ["pnpm", "npm", "yarn", "bun"] as const;
const RUNNERS = { pnpm: "pnpm dlx", npm: "npx", yarn: "yarn dlx", bun: "bunx" };
type PackageManager = (typeof PACKAGE_MANAGERS)[number];
const formatCssVarsRule = (
  selector: string,
  cssVars?: Record<string, string>
) =>
  `${selector} {\n${Object.entries(cssVars ?? {})
    .map(([key, value]) => `  --${key}: ${value};`)
    .join("\n")}\n}`;

const publicValue = (value: unknown): string =>
  typeof value === "string" ? value : "";
const InstallationFields = () => {
  const { installation, gateways, storageProviders, update } =
    useInstallation();
  const storage = storageProviders.find(
    (item) => item.id === installation?.storage?.source
  );
  return installation ? (
    <>
      <Field>
        <FieldLabel htmlFor="chatjs-gateway">Model gateway</FieldLabel>
        <select
          id="chatjs-gateway"
          className="border-input bg-background h-9 rounded-md border px-3 text-sm"
          value={installation.gateway}
          onChange={(event) => {
            update({ ...installation, gateway: event.target.value });
          }}
        >
          {gateways.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
            </option>
          ))}
        </select>
      </Field>
      <Field orientation="horizontal">
        <FieldContent>
          <FieldLabel htmlFor="chatjs-uploads">Attachment uploads</FieldLabel>
          <FieldDescription>
            Add files and images to conversations. Includes Vercel Sandbox for
            persistent files; configure its credentials in your app.
          </FieldDescription>
        </FieldContent>
        <Switch
          id="chatjs-uploads"
          checked={installation.plugins.includes("attachment-uploads")}
          onCheckedChange={(checked) => {
            update({
              ...installation,
              plugins: checked ? ["attachment-uploads"] : [],
            });
          }}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="chatjs-storage">Storage provider</FieldLabel>
        <select
          id="chatjs-storage"
          className="border-input bg-background h-9 rounded-md border px-3 text-sm"
          value={installation.storage?.source}
          onChange={(event) => {
            update({
              ...installation,
              storage: { source: event.target.value, options: {} },
            });
          }}
        >
          {storageProviders.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
            </option>
          ))}
        </select>
      </Field>
      {storage?.configKeys?.map((key) => (
        <Field key={key}>
          <FieldLabel htmlFor={`storage-${key}`}>Storage {key}</FieldLabel>
          <Input
            id={`storage-${key}`}
            value={publicValue(installation.storage?.options[key])}
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
          <FieldDescription>
            Public configuration only. Add credentials in your generated app’s
            environment.
          </FieldDescription>
        </Field>
      ))}
    </>
  ) : (
    <p role="alert">
      Invalid installation options in this link.{" "}
      <Link href="/create" className="underline">
        Start a new setup
      </Link>
      .
    </p>
  );
};

const useCreationOutput = (packageManager: PackageManager) => {
  const [params] = useDesignSystemSearchParams();
  const presetCode = usePresetCode();
  const { installation, storageProviders } = useInstallation();
  const preset = decodePreset(presetCode);
  const storage = storageProviders.find(
    (item) => item.id === installation?.storage?.source
  );
  const missingConfig =
    storage?.configKeys?.some(
      (key) => !publicValue(installation?.storage?.options[key]).trim()
    ) ?? false;
  const { base } = params;
  const supported =
    (base === "base" || base === "radix") && params.template === "next";
  const command =
    preset && installation && supported
      ? createCommand(preset, base, installation).replace(
          /^bunx/u,
          RUNNERS[packageManager]
        ) +
        (params.rtl ? " --rtl" : " --no-rtl") +
        (params.pointer ? " --pointer" : " --no-pointer")
      : "";
  const isRadiusLocked = params.style === "lyra" || params.style === "sera";
  let { radius } = params;
  if (isRadiusLocked) {
    radius = "none";
  } else if (params.style === "rhea" && radius === "large") {
    radius = "default";
  }
  const theme = buildThemeForPreset({
    ...DEFAULT_CONFIG,
    ...params,
    radius,
  });
  const themeCss = [
    formatCssVarsRule(":root", theme.cssVars?.light),
    formatCssVarsRule(".dark", theme.cssVars?.dark),
  ].join("\n\n");
  return { command, missingConfig, supported, themeCss };
};

export const ProjectForm = ({
  className,
}: React.ComponentProps<typeof Button>) => {
  const [open, setOpen] = React.useState(false);
  const [params, setParams] = useDesignSystemSearchParams();
  const [packageManager, setPackageManager] =
    React.useState<PackageManager>("bun");
  const [activeTab, setActiveTab] = React.useState("new-project");
  const [copied, setCopied] = React.useState(false);
  const { command, missingConfig, supported, themeCss } =
    useCreationOutput(packageManager);
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (copied) {
        setCopied(false);
      }
    }, 2000);
    return () => {
      clearTimeout(timer);
    };
  }, [copied]);
  const copyLabel = activeTab === "theme" ? "Copy Theme" : "Copy Command";
  const copy = async () => {
    setCopied(
      await copyToClipboardWithMeta(
        activeTab === "theme" ? themeCss : command,
        { name: "copy_chatjs_create" }
      )
    );
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className={cn(className)} />}>
        Get Code
      </DialogTrigger>
      <DialogContent className="dark no-scrollbar top-[64px] flex max-h-[calc(100svh-5rem)] translate-y-0 flex-col rounded-2xl p-0 shadow-xl **:data-[slot=dialog-close]:top-4.5 **:data-[slot=dialog-close]:right-4 sm:max-w-md">
        <div className="flex min-w-0 flex-1 flex-col gap-0 overflow-hidden rounded-2xl">
          <DialogHeader className="border-b px-6 py-5">
            <DialogTitle className="sr-only">
              Create your ChatJS app
            </DialogTitle>
            <ToggleGroup
              value={[activeTab]}
              onValueChange={(values) => {
                setActiveTab(values[0] ?? "new-project");
              }}
              aria-label="Project type"
              spacing={2}
            >
              <ToggleGroupItem value="new-project">New Project</ToggleGroupItem>
              <ToggleGroupItem value="theme">Theme</ToggleGroupItem>
            </ToggleGroup>
          </DialogHeader>
          <div className="no-scrollbar overflow-y-auto">
            {activeTab === "new-project" ? (
              <FieldGroup className="min-w-0 px-6 py-4">
                <FieldSet className="gap-3">
                  <FieldLegend variant="label">Base</FieldLegend>
                  <RadioGroup
                    value={params.base}
                    onValueChange={(value: string) => {
                      if (value === "base" || value === "radix") {
                        void setParams({ base: value });
                      }
                    }}
                    aria-label="Base"
                    className="grid grid-cols-3 gap-2"
                  >
                    {BASES.map((base) => (
                      <FieldLabel key={base.name} htmlFor={`base-${base.name}`}>
                        <Field orientation="horizontal">
                          <FieldContent>
                            {base.title}
                            {base.name === "aria" && (
                              <span className="text-muted-foreground text-xs">
                                Coming later
                              </span>
                            )}
                          </FieldContent>
                          <RadioGroupItem
                            disabled={base.name === "aria"}
                            value={base.name}
                            id={`base-${base.name}`}
                          />
                        </Field>
                      </FieldLabel>
                    ))}
                  </RadioGroup>
                  <FieldDescription>
                    ChatJS creates a Next.js app with Base UI or Radix.
                  </FieldDescription>
                </FieldSet>
                {!supported && (
                  <p role="alert" className="text-destructive text-sm">
                    This setup uses an unavailable base or framework. Choose
                    Base UI or Radix and Next.js to create ChatJS.
                  </p>
                )}
                <InstallationFields />
                <Field orientation="horizontal">
                  <FieldContent>
                    <FieldLabel htmlFor="chatjs-rtl">Right-to-left</FieldLabel>
                  </FieldContent>
                  <Switch
                    id="chatjs-rtl"
                    checked={params.rtl}
                    onCheckedChange={(rtl) => {
                      void setParams({ rtl });
                    }}
                  />
                </Field>
                <Field orientation="horizontal">
                  <FieldContent>
                    <FieldLabel htmlFor="chatjs-pointer">
                      Pointer cursor
                    </FieldLabel>
                  </FieldContent>
                  <Switch
                    id="chatjs-pointer"
                    checked={params.pointer}
                    onCheckedChange={(pointer) => {
                      void setParams({ pointer });
                    }}
                  />
                </Field>
              </FieldGroup>
            ) : (
              <FieldGroup className="min-w-0 px-6 py-4">
                <FieldSet className="min-w-0 gap-3">
                  <FieldLegend variant="label">Theme Tokens</FieldLegend>
                  <FieldDescription>
                    Copy the CSS variables for this preset.
                  </FieldDescription>
                  <pre className="bg-popover max-h-[45svh] overflow-auto rounded-xl border p-3 text-xs">
                    <code>{themeCss}</code>
                  </pre>
                </FieldSet>
              </FieldGroup>
            )}
            <DialogFooter className="m-0 min-w-0 p-6">
              <div className="flex w-full min-w-0 flex-col gap-3">
                {activeTab === "new-project" && (
                  <Tabs
                    value={packageManager}
                    onValueChange={(value) => {
                      const manager = PACKAGE_MANAGERS.find(
                        (item) => item === value
                      );
                      if (manager) {
                        setPackageManager(manager);
                      }
                    }}
                    className="ring-border min-w-0 gap-0 overflow-hidden rounded-xl border-0 ring-1"
                  >
                    <div className="flex items-center gap-2 py-1 pr-1.5 pl-1">
                      <TabsList className="bg-transparent font-mono">
                        {PACKAGE_MANAGERS.map((manager) => (
                          <TabsTrigger key={manager} value={manager}>
                            {manager}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        className="ml-auto"
                        disabled={!command || missingConfig}
                        onClick={() => {
                          void copy();
                        }}
                      >
                        {copied ? (
                          <HugeiconsIcon icon={Tick02Icon} />
                        ) : (
                          <HugeiconsIcon icon={Copy01Icon} />
                        )}
                        <span className="sr-only">Copy command</span>
                      </Button>
                    </div>
                    <div className="bg-popover overflow-x-auto border-t p-3">
                      <code
                        className="font-mono text-xs whitespace-nowrap"
                        data-testid="create-command"
                      >
                        {command || "Select a supported setup."}
                      </code>
                    </div>
                  </Tabs>
                )}
                {missingConfig && activeTab === "new-project" && (
                  <output className="text-muted-foreground text-xs">
                    Enter the storage configuration to continue.
                  </output>
                )}
                <Button
                  onClick={() => {
                    void copy();
                  }}
                  disabled={
                    activeTab === "new-project" && (!command || missingConfig)
                  }
                  className="h-9 w-full"
                >
                  {copied ? "Copied" : copyLabel}
                </Button>
              </div>
            </DialogFooter>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
