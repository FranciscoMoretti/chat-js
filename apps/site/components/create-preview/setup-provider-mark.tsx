import { Cpu, Database, Minus, Monitor, PlugZap, Route } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import styles from "./setup-provider-mark.module.css";
import { CapabilityVisual } from "./capability-visual";

import type {
  CreateIcon,
  CreateSymbol,
} from "../../../../packages/registry/create-icons";

const symbols = {
  cpu: Cpu,
  database: Database,
  minus: Minus,
  monitor: Monitor,
  plug: PlugZap,
  route: Route,
} satisfies Record<CreateSymbol, LucideIcon>;

const isSymbol = (icon: CreateIcon): icon is CreateSymbol =>
  Object.hasOwn(symbols, icon);

export const SetupProviderMark = ({
  icon = "monitor",
}: {
  readonly icon?: CreateIcon;
}) => {
  const Symbol = isSymbol(icon) ? symbols[icon] : undefined;
  if (Symbol !== undefined) {
    return (
      <span
        aria-hidden="true"
        className="text-muted-foreground flex size-9 items-center justify-center"
      >
        <Symbol className="size-8" strokeWidth={1.5} />
      </span>
    );
  }
  const monochrome = icon === "setup/vercel" || icon === "setup/openai";
  return (
    <span className={`${styles.mark} ${monochrome ? styles.monochrome : ""}`}>
      <CapabilityVisual id={icon} />
    </span>
  );
};
