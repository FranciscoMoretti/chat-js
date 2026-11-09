"use client";

import {
  Activity,
  ArrowRight,
  ChartNoAxesColumnIncreasing,
  FileText,
  Folder,
  Info,
  Link2,
  MessageSquare,
  Monitor,
  Plug,
  Puzzle,
  Route,
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
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldTitle,
} from "@/vendor/shadcn-create/styles/base-nova/ui/field";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
} from "@/vendor/shadcn-create/styles/base-nova/ui/popover";
import { useInstallation } from "./installation-provider";
import { pluginPreviewLabel } from "./preview-capabilities";

// Use the homepage illustrations’ motifs at the scale of a catalog row.
const pluginIcons: Readonly<Partial<Record<string, LucideIcon>>> = {
  projects: Folder,
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
  "vercel-analytics": ChartNoAxesColumnIncreasing,
  "vercel-speed-insights": Activity,
  langfuse: Route,
  desktop: Monitor,
};

export const FeatureChoices = ({
  items,
  cards = false,
}: {
  readonly items: readonly InstallationCatalogItem[];
  readonly cards?: boolean;
}) => {
  const { installation, resolution, update } = useInstallation();
  if (!installation || !resolution) {
    return null;
  }
  return (
    <div className={cards ? "grid gap-3 sm:grid-cols-2" : "divide-y"}>
      {items.map((item) => {
        const { definition } = item;
        if (definition?.kind !== "plugin" && definition?.kind !== "tool") {
          return null;
        }
        const key = definition.kind === "plugin" ? "plugins" : "tools";
        const { id } = definition;
        const Icon =
          definition.kind === "plugin"
            ? (pluginIcons[id] ?? Puzzle)
            : undefined;
        const icon =
          Icon === undefined ? null : (
            <Icon
              aria-hidden="true"
              className="text-muted-foreground size-4 shrink-0"
            />
          );
        const selected = resolution.selection[key].includes(id);
        const requiredBy = resolution.reasons[item.name] ?? [];
        const isThisItem = (source: string) =>
          source === id ||
          source === item.name ||
          source === `@chatjs/${item.name}`;
        const explicit = installation[key].some(isThisItem);
        const onCheckedChange = (checked: boolean) => {
          update({
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
                      ? "text-muted-foreground absolute end-3 top-3 size-7"
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
                  ? pluginPreviewLabel(id, Boolean(definition.client))
                  : "Tool scenes"}
              </p>
            </PopoverContent>
          </Popover>
        );
        if (cards) {
          return (
            <div key={item.name} className="relative h-full">
              <FieldLabel
                htmlFor={control.id}
                className="h-full cursor-pointer"
              >
                <Field
                  orientation="horizontal"
                  className="h-full min-h-28 gap-4 p-4!"
                >
                  <FieldContent className="min-w-0 gap-2">
                    <FieldTitle>
                      {icon}
                      {item.title}
                    </FieldTitle>
                    <FieldDescription className="text-xs leading-relaxed">
                      {item.description}
                    </FieldDescription>
                  </FieldContent>
                  <Checkbox {...control} className="me-8 mt-0.5" />
                </Field>
              </FieldLabel>
              {details}
            </div>
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
            </div>
            {details}
            <Switch {...control} />
          </div>
        );
      })}
    </div>
  );
};
