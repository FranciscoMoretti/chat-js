import { toolDefinitions } from "./tool-definitions";
import { Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { composerTools as installed } from "@/chatjs/generated/composer-tools";

export const composerTools: Readonly<
  Record<
    string,
    { icon: LucideIcon; name: string; shortName: string } | undefined
  >
> = {
  ...Object.fromEntries(
    toolDefinitions.flatMap((definition) =>
      definition.display
        ? [[definition.name, { icon: Wrench, ...definition.display }]]
        : []
    )
  ),
  ...installed,
};
