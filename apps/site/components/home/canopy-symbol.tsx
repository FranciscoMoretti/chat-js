import type { ReactNode } from "react";
import { FileSearch, Sheet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AgentCategoryIcon } from "../create-preview/agent-category-icon";
import { capabilitySymbol } from "../create-preview/capability-symbol";
import { pluginIcons } from "../create-preview/plugin-icons";

const homeIcons: Readonly<Partial<Record<string, LucideIcon>>> = {
  ...pluginIcons,
  "deep-research": FileSearch,
  "spreadsheet-viewer": Sheet,
};

export const canopySymbol = (id: string): ReactNode => {
  const Icon = homeIcons[id];
  if (Icon) {
    return <Icon aria-hidden="true" />;
  }
  return (
    capabilitySymbol(id) ??
    capabilitySymbol(`@chatjs/${id}`) ?? (
      <AgentCategoryIcon category={id.split("/")[0]} />
    )
  );
};
