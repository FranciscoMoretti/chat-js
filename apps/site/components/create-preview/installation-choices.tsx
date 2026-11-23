"use client";

import { hasPluginEntry } from "../../../../packages/registry/plugin-entry";
import {
  ArrowRight,
  FileText,
  Folder,
  Info,
  Images,
  Video,
  Link2,
  MessageSquare,
  Monitor,
  Plug,
  Puzzle,
  Search,
  SlidersHorizontal,
  TextCursorInput,
  ThumbsUp,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { InstallationCatalogItem } from "../../../../packages/registry/installation-catalog";
import { Button } from "@/vendor/shadcn-create/styles/base-nova/ui/button";
import { Checkbox } from "@/vendor/shadcn-create/styles/base-nova/ui/checkbox";
import { Switch } from "@/vendor/shadcn-create/styles/base-nova/ui/switch";
import { FieldLabel } from "@/vendor/shadcn-create/styles/base-nova/ui/field";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
} from "@/vendor/shadcn-create/styles/base-nova/ui/popover";
import { SetupTile, setupTileGrid, setupTileControl } from "./setup-tile";
import { SetupProviderMark } from "./setup-provider-mark";
import { CapabilityRow } from "./capability-row";
import type { InstallationSelection } from "../../../../packages/registry/installation";
import { useInstallation } from "./installation-provider";
import { setupActions } from "./setup-guidance";
import type { ConfigureSetup } from "./setup-guidance";
import { pluginPreviewLabel } from "./preview-capabilities";

// Use the homepage illustrations’ motifs at the scale of a catalog row.
const pluginIcons: Readonly<Partial<Record<string, LucideIcon>>> = {
  projects: Folder,
  "image-viewer": Images,
  "video-viewer": Video,
  search: Search,
  "ai-titles": TextCursorInput,
  sharing: Link2,
  feedback: ThumbsUp,
  "followup-suggestions": ArrowRight,
  "model-preferences": SlidersHorizontal,
  "attachment-uploads": FileText,
  mcp: Plug,
  "guest-chat": MessageSquare,
  credits: Wallet,
  desktop: Monitor,
};

const requiresChatjs = (
  definition: InstallationCatalogItem["definition"]
): boolean =>
  definition?.kind === "plugin" ||
  (definition?.kind === "tool" &&
    (definition.requiresChatJS ?? definition.native === undefined));

const toolBadge = (definition: InstallationCatalogItem["definition"]) =>
  definition?.kind === "tool" && definition.agentCategory !== undefined
    ? "ChatJS"
    : undefined;

const capabilityCategory = (
  definition: InstallationCatalogItem["definition"]
) =>
  definition?.kind === "tool" ? (definition.agentCategory ?? "tool") : "plugin";

const FeatureIcon = ({
  definition,
}: {
  readonly definition: InstallationCatalogItem["definition"];
}) => {
  const Icon =
    definition?.kind === "plugin"
      ? (pluginIcons[definition.id] ?? Puzzle)
      : undefined;
  return Icon === undefined ? null : (
    <Icon
      aria-hidden="true"
      className="text-muted-foreground size-4 shrink-0"
    />
  );
};

const setupCaptions: Readonly<Record<string, string>> = {
  desktop: "Desktop app",
};

export const FeatureChoices = ({
  items,
  className,
  cards = false,
  compact = false,
  onSelectionChange,
  onConfigureSetup,
}: {
  readonly items: readonly InstallationCatalogItem[];
  readonly className?: string;
  readonly cards?: boolean;
  readonly compact?: boolean;
  readonly onSelectionChange?: (selection: InstallationSelection) => void;
  readonly onConfigureSetup?: ConfigureSetup;
}) => {
  const { installation, resolution, update } = useInstallation();
  if (!installation || !resolution) {
    return null;
  }
  const applySelection = onSelectionChange ?? update;
  const gridClass = compact ? "grid gap-3 md:grid-cols-2" : setupTileGrid;
  return (
    <div className={className ?? (cards || compact ? gridClass : "divide-y")}>
      {items.map((item) => {
        const { definition } = item;
        if (definition?.kind !== "plugin" && definition?.kind !== "tool") {
          return null;
        }
        const key = definition.kind === "plugin" ? "plugins" : "tools";
        const { id } = definition;
        const icon = <FeatureIcon definition={definition} />;
        const selected = resolution.selection[key].includes(id);
        const actions = selected
          ? setupActions(
              resolution.issues.filter((issue) =>
                issue.startsWith(`${id} requires`)
              )
            )
          : [];
        const requiredBy = resolution.reasons[item.name] ?? [];
        const isThisItem = (source: string) =>
          source === id ||
          source === item.name ||
          source === `@chatjs/${item.name}`;
        const explicit = installation[key].some(isThisItem);
        const onCheckedChange = (checked: boolean) => {
          applySelection({
            ...installation,
            [key]: checked
              ? [...installation[key], id]
              : installation[key].filter((value) => !isThisItem(value)),
          });
        };
        const control = {
          id: `feature-${item.name}`,
          "aria-label": item.title,
          checked: selected,
          disabled: !explicit && requiredBy.length > 0,
          onCheckedChange,
        };
        const dependency = requiredBy.length
          ? `Required by ${requiredBy.join(", ")}`
          : null;
        const details = (
          <Popover>
            <PopoverTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className={
                    cards
                      ? "text-muted-foreground absolute start-1 top-1 size-7"
                      : "text-muted-foreground size-7"
                  }
                />
              }
              aria-label={`About ${item.title}`}
            >
              <Info className="size-3.5" />
            </PopoverTrigger>
            <PopoverContent side="right" className="w-64">
              <PopoverHeader>
                <PopoverTitle>{item.title}</PopoverTitle>
                <PopoverDescription>{item.description}</PopoverDescription>
              </PopoverHeader>
              {dependency !== null && <p className="text-xs">{dependency}</p>}
              <p className="text-muted-foreground text-xs">
                {definition.kind === "plugin"
                  ? pluginPreviewLabel(
                      id,
                      hasPluginEntry(definition, "chat-ui") ||
                        hasPluginEntry(definition, "layout-ui")
                    )
                  : "Tool examples"}
              </p>
            </PopoverContent>
          </Popover>
        );
        if (compact) {
          return (
            <CapabilityRow
              key={item.name}
              title={item.title}
              visualId={`@chatjs/${item.name}`}
              category={capabilityCategory(definition)}
              description={item.description}
              source="ChatJS"
              badge={toolBadge(definition)}
              requiresChatJS={requiresChatjs(definition)}
              controlId={control.id}
              checked={selected}
              disabled={control.disabled}
              onCheckedChange={onCheckedChange}
              details={dependency === null ? undefined : <p>{dependency}</p>}
            />
          );
        }
        if (cards) {
          return (
            <SetupTile
              key={item.name}
              title={item.title}
              caption={setupCaptions[id] ?? "Optional feature"}
              controlId={control.id}
              visual={<SetupProviderMark id={id} />}
              control={<Checkbox {...control} className={setupTileControl} />}
              action={details}
            />
          );
        }
        return (
          <div
            key={item.name}
            className="flex min-h-12 items-center gap-2 py-2"
          >
            <div className="min-w-0 flex-1">
              <FieldLabel
                htmlFor={control.id}
                className="items-center text-xs font-normal"
              >
                {icon}
                {item.title}
              </FieldLabel>
              {onConfigureSetup &&
                actions.map((action) => (
                  <Button
                    key={action.destination}
                    variant="link"
                    size="sm"
                    className="h-auto justify-start p-0 text-xs"
                    onClick={() => {
                      onConfigureSetup(action.destination);
                    }}
                  >
                    {action.label}
                  </Button>
                ))}
            </div>
            {details}
            {definition.kind === "tool" ? (
              <Checkbox {...control} />
            ) : (
              <Switch {...control} />
            )}
          </div>
        );
      })}
    </div>
  );
};
