import { config } from "@/lib/config";

/** Application model picker choices. Native EVE agents configure their own model. */
export const webModels: {
  readonly model?: string;
  readonly allowedModels: readonly string[];
} = {
  model: config.ai.workflows.chat,
  allowedModels: [],
};
