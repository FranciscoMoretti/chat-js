import {
  Activity,
  AppWindow,
  BookOpen,
  BrainCircuit,
  Layers,
  MessagesSquare,
  Plug,
  Puzzle,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const categoryIcons: Readonly<Record<string, LucideIcon>> = {
  tool: Wrench,
  connection: Plug,
  channel: MessagesSquare,
  skill: BookOpen,
  extension: Puzzle,
  memory: BrainCircuit,
  instrumentation: Activity,
  application: AppWindow,
};

export const AgentCategoryIcon = ({
  category,
  className = "size-4 shrink-0",
}: {
  readonly category: string;
  readonly className?: string;
}) => {
  const Icon = categoryIcons[category] ?? Layers;
  return <Icon className={className} aria-hidden="true" />;
};
