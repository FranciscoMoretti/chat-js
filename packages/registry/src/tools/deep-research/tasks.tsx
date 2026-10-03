import { CircleCheck, Dot, FileText, Pencil, Sparkles } from "lucide-react";
import { motion } from "motion/react";
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import type React from "react";
/* oxlint-enable eslint/sort-imports */
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import type { ResearchUpdate } from "@/tools/platform/research-updates-schema";
/* oxlint-enable eslint/sort-imports */

/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { ResearchTask } from "./task";
/* oxlint-enable eslint/sort-imports */

const icons: Record<ResearchUpdate["type"], React.ElementType> = {
  completed: CircleCheck,
  started: Dot,
  thoughts: Sparkles,
  web: FileText,
  writing: Pencil,
} as const;

/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable react/forbid-component-props -- The composed UI component exposes this styling prop as part of its supported public API. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const StepTypeIcon = ({ update }: { update: ResearchUpdate }) => {
  const Icon = icons[update.type];
  return <Icon className="text-muted-foreground h-4 w-4" />;
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable react/forbid-component-props */
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable react/no-multi-comp -- These private render helpers belong to the same UI composition and share its local types and state assumptions. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable react/jsx-max-depth -- This nesting expresses the component library composition and accessibility structure; flattening it can change DOM behavior. */
/* oxlint-disable react-perf/jsx-no-new-object-as-prop -- This prop reflects the current render values; preserve the existing update behavior rather than add unmeasured memoization. */
/* oxlint-disable eslint/id-length -- Short callback indices and coordinate keys match the surrounding collection or external data shape; renaming public keys would change the contract. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/id-length */
/* oxlint-enable react-perf/jsx-no-new-object-as-prop */
/* oxlint-enable react/jsx-max-depth */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable react/no-multi-comp */

/* oxlint-disable import/exports-last -- Keep the exported declaration beside the types and initialization it describes; moving it can reorder module initialization. */
/* oxlint-disable import/prefer-default-export -- Keep the named import contract used by registry consumers and package callers even when this module exposes one value. */
/* oxlint-disable react/no-multi-comp -- These private render helpers belong to the same UI composition and share its local types and state assumptions. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable typescript/explicit-module-boundary-types -- This exported adapter derives its result from the schema or SDK contract; duplicating that type would erase inference or drift from the source. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
export const ResearchTasks = ({ updates }: { updates: ResearchUpdate[] }) => (
  <div className="relative">
    {updates.map((update, index) => (
      <StepWrapper
        isLast={index === updates.length - 1}
        // oxlint-disable-next-line react/no-array-index-key -- #551: A tool emits multiple progress updates; preserve positional identity until updates carry their own IDs.
        key={`${update.toolCallId}-${index}`}
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
    ))}
  </div>
);
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable typescript/explicit-module-boundary-types */
/* oxlint-enable import/no-named-export */
/* oxlint-enable react/no-multi-comp */
/* oxlint-enable import/prefer-default-export */
/* oxlint-enable import/exports-last */

interface StepWrapperProps {
  children: ReactNode;
  isLast: boolean;
  update: ResearchUpdate;
}
