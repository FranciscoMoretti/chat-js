import { defineAgent, defineDynamic } from "eve";

import { resolveEveModel } from "@/lib/eve/model-selection";

import { getDeepResearchConfig } from "./configuration";

/* oxlint-disable typescript/explicit-module-boundary-types -- This exported adapter derives its result from the schema or SDK contract; duplicating that type would erase inference or drift from the source. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
export const defineResearchAgent = (
  phase: "research" | "compression" | "final_report"
) =>
  defineAgent({
    defaultTools: false,
    description: `Deep research ${phase} phase. Called by the research workflow.`,
    model: defineDynamic({
      events: {
        "step.started": () =>
          resolveEveModel(getDeepResearchConfig()[`${phase}_model`]),
      },
    }),
    tool: false,
  });
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable typescript/explicit-module-boundary-types */
