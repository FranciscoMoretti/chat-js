import { CircleCheck, Dot, FileText, Pencil, Sparkles } from "lucide-react";
import { motion } from "motion/react";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type React from "react";
import type { ReactNode } from "react";
/* oxlint-enable sort-imports */

import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { cn } from "@/lib/utils";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { ResearchUpdate } from "@/tools/platform/research-updates-schema";
/* oxlint-enable sort-imports */

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import { ResearchTask } from "./task";
/* oxlint-enable sort-imports */

const icons: Record<ResearchUpdate["type"], React.ElementType> = {
  completed: CircleCheck,
  started: Dot,
  thoughts: Sparkles,
  web: FileText,
  writing: Pencil,
} as const;

/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */

const StepTypeIcon = ({
  update,
}: Readonly<{ update: Readonly<Pick<ResearchUpdate, "type">> }>) => {
  const Icon = icons[update.type];
  return (
    <Icon
      // oxlint-disable-next-line react/forbid-component-props -- Icon is selected from the closed Lucide SVG icon map; className sets its size and color.
      className="text-muted-foreground h-4 w-4"
    />
  );
};
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable react/no-multi-comp -- These private render helpers belong to the same UI composition and share its local types and state assumptions. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable react/jsx-max-depth -- This nesting expresses the component library composition and accessibility structure; flattening it can change DOM behavior. */
/* oxlint-disable react-perf/jsx-no-new-object-as-prop -- This prop reflects the current render values; preserve the existing update behavior rather than add unmeasured memoization. */
/* oxlint-disable eslint/id-length -- Short callback indices and coordinate keys match the surrounding collection or external data shape; renaming public keys would change the contract. */
const StepWrapper = ({ update, children, isLast }: StepWrapperProps) => (
  <div className="flex w-full flex-row items-stretch justify-start gap-2">
    <div className="flex min-h-full shrink-0 flex-col items-center justify-start px-2">
      <div className="bg-border/50 h-1 shrink-0" />
      <div className="bg-background z-10 py-0.5">
        <StepTypeIcon update={update} />
      </div>
      <motion.div
        animate={{ height: "100%" }}
        className={cn(
          "border-border min-h-full w-px flex-1 border-l border-dashed",
          isLast && "hidden"
        )}
        initial={{ height: 0 }}
        transition={{ duration: 0.5 }}
      />
    </div>
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="flex w-full flex-1 flex-col gap-4 overflow-hidden pt-1 pr-2 pb-2"
      initial={{ opacity: 0, y: 5 }}
      transition={{ duration: 0.3 }}
    >
      {children}
    </motion.div>
  </div>
);
/* oxlint-enable eslint/id-length */
/* oxlint-enable react-perf/jsx-no-new-object-as-prop */
/* oxlint-enable react/jsx-max-depth */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable react/no-multi-comp */

/* oxlint-disable react/no-multi-comp -- These private render helpers belong to the same UI composition and share its local types and state assumptions. */
/* oxlint-disable typescript/explicit-module-boundary-types -- This exported adapter derives its result from the schema or SDK contract; duplicating that type would erase inference or drift from the source. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
const ResearchTasks = ({
  updates,
}: ReadonlyNativeSurface<{ updates: ResearchUpdate[] }>) => {
  const occurrences = new Map<string, number>();
  return (
    <div className="relative">
      {updates.map((update: ReadonlyNativeSurface<ResearchUpdate>, index) => {
        const identity = `${update.type}:${update.toolCallId}`;
        const occurrence = occurrences.get(identity) ?? 0;
        occurrences.set(identity, occurrence + 1);
        return (
          <StepWrapper
            isLast={index === updates.length - 1}
            key={`${identity}:${occurrence}`}
            update={update}
          >
            <ResearchTask
              isRunning={
                (update.type === "web" && update.status === "running") ||
                (index === updates.length - 1 && update.type !== "completed")
              }
              minimal={false}
              update={update}
            />
          </StepWrapper>
        );
      })}
    </div>
  );
};
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable typescript/explicit-module-boundary-types */
/* oxlint-enable react/no-multi-comp */

interface StepWrapperProps {
  readonly children: ReadonlyNativeSurface<ReactNode>;
  readonly isLast: boolean;
  readonly update: ReadonlyNativeSurface<ResearchUpdate>;
}
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (ResearchTasks); the enabled import/no-default-export convention rejects the default-export alternative. */
export { ResearchTasks };
/* oxlint-enable import/prefer-default-export, import/no-named-export */
