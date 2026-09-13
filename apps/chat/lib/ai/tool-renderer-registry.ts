import type { ComponentType } from "react";

import { ui } from "@/tools/chatjs/ui";

import type { installedTools } from "./installed-tools";

type InstalledToolRenderer = ComponentType<{
  tool: unknown;
  messageId: string;
  isReadonly: boolean;
}>;

type InstalledToolType = `tool-${keyof typeof installedTools & string}`;
export type ToolRendererRegistry = {
  [K in InstalledToolType]: InstalledToolRenderer;
};

// The core also supports fresh apps with no optional tools installed.
const renderers: Readonly<Partial<Record<string, InstalledToolRenderer>>> =
  ui satisfies ToolRendererRegistry;

export function getInstalledToolRenderer(type: string) {
  return Object.hasOwn(renderers, type) ? renderers[type] : undefined;
}
