"use client";

// ChatJS adaptation of upstream ProjectForm. Native dialog, field/toggle/tabs
// structure is retained; ChatJS's existing installation selection replaces the
// upstream framework/template choices because ChatJS owns its Next.js scaffold.
import { setupAction } from "./setup-guidance";
import type { ConfigureSetup } from "./setup-guidance";
import * as React from "react";
import { Copy01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "cn";
import { MousePointer2 } from "lucide-react";
import { decodePreset } from "shadcn/preset";
import { copyToClipboardWithMeta } from "@/components/create-preview/copy-clipboard";
import type { InstallationSelection } from "../../../../packages/registry/installation";
import { encodeInstallationInput } from "../../../../packages/registry/app-preset";
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
  FieldSet,
  FieldLegend,
} from "@/vendor/shadcn-create/styles/base-nova/ui/field";
import { Switch } from "@/vendor/shadcn-create/styles/base-nova/ui/switch";

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

// Pinned upstream logos are rendered as CSS masks, never injected as markup.
const logoMask = (logo: unknown): string | undefined => {
  if (typeof logo !== "string") {
    return undefined;
  }
  const svg = logo.includes("xmlns=")
    ? logo
    : logo.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
};

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

const appPresetForSelection = (selection?: InstallationSelection) =>
  selection ? encodeInstallationInput(selection).code : null;

const useCreationOutput = (packageManager: PackageManager) => {
  const [params] = useDesignSystemSearchParams();
  const presetCode = usePresetCode();
  const { resolution } = useInstallation();
  const installation = resolution?.selection;
  const preset = decodePreset(presetCode);
  const { base } = params;
  const supported =
    (base === "base" || base === "radix") && params.template === "next";
  const command =
    preset && installation && supported && resolution?.issues.length === 0
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
  return {
    command,
    supported,
    appPreset: command ? appPresetForSelection(installation) : null,
    appearancePreset: presetCode,
    themeCss,
    warnings: resolution?.issues ?? [
      "Invalid installation options in this link.",
    ],
  };
};

export const ProjectForm = ({
  className,
  onConfigureSetup,
}: React.ComponentProps<typeof Button> & {
  readonly onConfigureSetup: ConfigureSetup;
}) => {
  const { resolution, catalog } = useInstallation();
  const [open, setOpen] = React.useState(false);
  const [params, setParams] = useDesignSystemSearchParams();
  const [packageManager, setPackageManager] =
    React.useState<PackageManager>("bun");
  const [activeTab, setActiveTab] = React.useState("new-project");
  const [copied, setCopied] = React.useState(false);
  const {
    command,
    supported,
    appPreset,
    appearancePreset,
    themeCss,
    warnings,
  } = useCreationOutput(packageManager);
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
              <FieldGroup className="min-w-0 gap-0 divide-y">
                <section
                  aria-label="Selection summary"
                  className="space-y-3 px-6 py-4"
                >
                  <h2 className="text-sm font-medium">Your app</h2>
                  <dl className="space-y-2 text-xs">
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Appearance</dt>
                      <dd className="capitalize">
                        {params.style} · {params.theme}
                      </dd>
                    </div>
                    {(["plugins", "tools"] as const).map((kind) => {
                      const titles =
                        resolution?.items
                          .filter(
                            (item) =>
                              item.definition?.kind ===
                              (kind === "plugins" ? "plugin" : "tool")
                          )
                          .map((item) => item.title) ?? [];
                      return (
                        <div key={kind} className="flex justify-between gap-4">
                          <dt className="text-muted-foreground capitalize">
                            {kind}
                          </dt>
                          <dd className="max-w-[75%] text-right">
                            {titles.length ? titles.join(", ") : "None"}
                          </dd>
                        </div>
                      );
                    })}
                    {(["gateway", "storage", "sandbox"] as const).map(
                      (kind) => {
                        const source =
                          kind === "storage"
                            ? resolution?.selection.storage?.source
                            : resolution?.selection[kind];
                        return (
                          <div
                            key={kind}
                            className="flex justify-between gap-4"
                          >
                            <dt className="text-muted-foreground capitalize">
                              {kind}
                            </dt>
                            <dd className="text-right">
                              {catalog.find(
                                (item) =>
                                  item.definition?.kind === kind &&
                                  item.definition.id === source
                              )?.title ?? "None"}
                            </dd>
                          </div>
                        );
                      }
                    )}
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">App preset</dt>
                      <dd>
                        <code
                          data-testid="app-preset-code"
                          className="select-all"
                        >
                          {appPreset ?? "Complete setup first"}
                        </code>
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">
                        Appearance preset
                      </dt>
                      <dd>
                        <code
                          data-testid="appearance-preset-code"
                          className="select-all"
                        >
                          {appearancePreset}
                        </code>
                      </dd>
                    </div>
                  </dl>
                </section>
                <div className="px-6 py-4">
                  <FieldSet className="gap-3">
                    <FieldLegend variant="label">Base</FieldLegend>
                    <ToggleGroup
                      value={[params.base]}
                      onValueChange={(values) => {
                        const [base] = values;
                        if (base === "base" || base === "radix") {
                          void setParams({ base });
                        }
                      }}
                      aria-label="Component library"
                      variant="outline"
                      className="w-full"
                    >
                      {BASES.filter((base) => base.name !== "aria").map(
                        (base) => (
                          <ToggleGroupItem
                            key={base.name}
                            value={base.name}
                            className="h-12 flex-1 justify-start gap-2 px-4"
                          >
                            <span
                              aria-hidden="true"
                              className="size-4 bg-current mask-contain mask-center mask-no-repeat"
                              style={{ maskImage: logoMask(base.meta?.logo) }}
                            />
                            {base.title}
                          </ToggleGroupItem>
                        )
                      )}
                    </ToggleGroup>
                    <FieldDescription>
                      Your app uses the selected library. The live preview uses
                      Base UI.
                    </FieldDescription>
                  </FieldSet>
                </div>
                <Field className="px-6 py-4" orientation="horizontal">
                  <FieldContent>
                    <FieldLabel htmlFor="chatjs-pointer">
                      <MousePointer2 className="size-4" />
                      Use pointer on buttons
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
                {!supported && (
                  <p
                    role="alert"
                    className="text-destructive px-6 py-4 text-sm"
                  >
                    Choose Base UI or Radix UI and Next.js to create ChatJS.
                  </p>
                )}
                <p className="text-muted-foreground px-6 py-4 text-xs">
                  Add API keys and other credentials after installation. The App
                  preset contains built-in selections; custom provider values
                  are included separately in the command. This command requires
                  the CLI from this branch until App presets are released.
                </p>
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
                        disabled={!command}
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
                        className={cn(
                          "font-mono text-xs",
                          command ? "whitespace-nowrap" : "whitespace-normal"
                        )}
                        data-testid="create-command"
                      >
                        {command ||
                          "Resolve the choices below to get your command."}
                      </code>
                    </div>
                  </Tabs>
                )}
                {activeTab === "new-project" && (
                  <ul
                    className="text-muted-foreground list-disc pl-4 text-xs"
                    aria-label="Installation issues"
                  >
                    {warnings.map((warning) => (
                      <li key={warning} className="mb-3">
                        <p>{warning}</p>
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto p-0 text-xs"
                          onClick={() => {
                            setOpen(false);
                            onConfigureSetup(setupAction(warning).destination);
                          }}
                        >
                          {setupAction(warning).label}
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
                <Button
                  onClick={() => {
                    void copy();
                  }}
                  disabled={activeTab === "new-project" && !command}
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
