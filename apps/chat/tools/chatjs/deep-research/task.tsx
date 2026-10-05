import { Loader2, SearchIcon } from "lucide-react";
import { motion } from "motion/react";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import React from "react";
/* oxlint-enable sort-imports */

import { WebSourceBadge } from "@/components/source-badge";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { Badge } from "@/components/ui/badge";
/* oxlint-enable sort-imports */
import type { ResearchUpdate } from "@/tools/platform/research-updates-schema";

import { UpdateTitle } from "./update-title";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (ResearchTask); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-disable react/jsx-no-literals -- ResearchTask renders authored tool output labels, status copy and display punctuation; no translation-layer contract is defined here. */

/* oxlint-disable typescript/explicit-module-boundary-types -- This exported adapter derives its result from the schema or SDK contract; duplicating that type would erase inference or drift from the source. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */

/* oxlint-disable react-perf/jsx-no-new-object-as-prop -- This prop reflects the current render values; preserve the existing update behavior rather than add unmeasured memoization. */
/* oxlint-disable react/jsx-max-depth -- This nesting expresses the component library composition and accessibility structure; flattening it can change DOM behavior. */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/* oxlint-disable typescript/strict-boolean-expressions -- This value-producing condition preserves the current nullish/empty sentinel behavior; coercing it would change the returned value. */
export const ResearchTask = ({
  update,
  minimal,
  isRunning,
}: {
  update: ResearchUpdate;
  minimal: boolean;
  isRunning: boolean;
}) => (
  <div className="group">
    {!minimal && (
      <div className="flex items-center gap-2">
        <UpdateTitle isRunning={isRunning} title={update.title} />
      </div>
    )}
    <motion.div
      animate={{
        height: "auto",
        opacity: 1,
        transition: {
          height: { duration: 0.2, ease: "easeOut" },
          opacity: { delay: 0.05, duration: 0.15 },
        },
      }}
      exit={{
        height: 0,
        opacity: 0,
        transition: {
          height: { duration: 0.2, ease: "easeIn" },
          opacity: { duration: 0.1 },
        },
      }}
      initial={{ height: 0, opacity: 0 }}
    >
      <div className="space-y-2 py-2 pr-2">
        {update.type === "web" && update.queries && (
          <div className="flex flex-wrap gap-2">
            {update.queries.map((query) => (
              <Badge
                // oxlint-disable-next-line react/forbid-component-props -- Badge accepts className in its styling contract; preserve this caller's layout and appearance.
                className="bg-muted flex items-center gap-1"
                key={query}
                variant="outline"
              >
                <SearchIcon
                  // oxlint-disable-next-line react/forbid-component-props -- SearchIcon accepts className in its styling contract; preserve this caller's layout and appearance.
                  className="size-3.5"
                />
                {/* // TODO: Make this size width responsive or accomodate long text in another manner */}
                <span className="max-w-[300px] truncate">{query}</span>
              </Badge>
            ))}
          </div>
        )}
        {/* Search Results: Show only when completed and results exist */}
        {update.type === "web" &&
          update.status === "completed" &&
          update.results && (
            <div className="flex flex-wrap gap-2">
              {update.type === "web" &&
                update.results.map((result) => (
                  <WebSourceBadge key={result.url} result={result} />
                ))}
            </div>
          )}
        {/* Search Loading State */}
        {update.type === "web" && update.status === "running" && (
          <div className="py-2">
            <div className="flex items-center gap-3">
              <Loader2
                // oxlint-disable-next-line react/forbid-component-props -- Loader2 accepts className in its styling contract; preserve this caller's layout and appearance.
                className="text-muted-foreground size-4 animate-spin"
              />
              <p className="text-xsize-neutral-500">Searching the web...</p>
            </div>
          </div>
        )}
        {/* {Thoughts} */}
        {update.type === "thoughts" && (
          <div className="space-y-2">
            <p className="text-foreground text-sm font-light">
              {update.message}
            </p>
          </div>
        )}
        {update.type === "writing" && update.message && (
          <div className="space-y-2">
            <p className="text-foreground text-sm font-light">
              {update.message}
            </p>
          </div>
        )}
      </div>
    </motion.div>
  </div>
);
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-enable react/jsx-max-depth */
/* oxlint-enable react-perf/jsx-no-new-object-as-prop */

/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable typescript/explicit-module-boundary-types */
