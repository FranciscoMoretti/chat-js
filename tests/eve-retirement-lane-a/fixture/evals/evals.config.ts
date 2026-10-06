import { defineEvalConfig } from "eve/evals";

// oxlint-disable-next-line import/no-default-export -- EVE loads its evaluation config through its default export.
export default defineEvalConfig({ maxConcurrency: 1 });
