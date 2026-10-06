import { defineEvalConfig } from "eve/evals";

// oxlint-disable-next-line import/no-default-export -- EVE discovers this authored fixture through its required default export.
export default defineEvalConfig({ maxConcurrency: 1 });
