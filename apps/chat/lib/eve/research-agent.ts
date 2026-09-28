import { wrapLanguageModel } from "ai";
import { defineAgent, defineDynamic } from "eve";

import { getDeepResearchConfig } from "../../tools/platform/deep-research/configuration";
import { resolveEveModel } from "./model-selection";

export const defineResearchAgent = (
  phase: "research" | "compression" | "final_report"
) =>
  defineAgent({
    defaultTools: false,
    description: `Deep research ${phase} phase. Called by the research workflow.`,
    model: defineDynamic({
      events: {
        "step.started": async () => {
          const config = getDeepResearchConfig();
          const selection = await resolveEveModel(config[`${phase}_model`]);
          return {
            ...selection,
            model: wrapLanguageModel({
              middleware: {
                specificationVersion: "v4",
                transformParams: ({ params }) =>
                  Promise.resolve({
                    ...params,
                    maxOutputTokens: config[`${phase}_model_max_tokens`],
                  }),
              },
              model: selection.model,
            }),
          };
        },
      },
    }),
    tool: false,
  });
