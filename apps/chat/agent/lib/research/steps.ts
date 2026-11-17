import { researchOptions } from "./configuration";

// oxlint-disable-next-line eslint/func-style, eslint/require-await -- EVE requires async step declarations. Record the clock and authored options once for workflow replay.
export async function prepareResearch(request: string) {
  "use step";
  return {
    config: researchOptions,
    date: new Date().toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      weekday: "short",
      year: "numeric",
    }),
    messages: request,
    timestamp: Date.now(),
  };
}

// oxlint-disable-next-line eslint/func-style, eslint/require-await -- EVE requires async step declarations. Completion time is a durable workflow step.
export async function researchCompletedAt() {
  "use step";
  return Date.now();
}
