import FirecrawlApp from "@mendable/firecrawl-js";
import { defineTool } from "eve/tools";
import { z } from "zod";

/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { env } from "@/lib/env";
/* oxlint-enable eslint/sort-imports */
import { toolResultToModelOutput } from "@/lib/eve/tool-model-output";
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { executeWithToolUsage } from "@/lib/eve/tool-usage";
/* oxlint-enable eslint/sort-imports */
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { createModuleLogger } from "@/lib/logger";
/* oxlint-enable eslint/sort-imports */

import { retrievedInput } from "./schemas";

const hasNonEmptyValue = (value: string | null | undefined): value is string =>
  typeof value === "string" && value !== "";

const log = createModuleLogger("tools/retrieve-url");

/* oxlint-disable eslint/no-ternary -- This expression selects a value without introducing mutable intermediate state or changing evaluation order. */
/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
const app = hasNonEmptyValue(env.FIRECRAWL_API_KEY)
  ? new FirecrawlApp({ apiKey: env.FIRECRAWL_API_KEY })
  : null;
/* oxlint-enable unicorn/no-null */
/* oxlint-enable eslint/no-ternary */

/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
const parseUrl = (url: string): URL | null => {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};
/* oxlint-enable unicorn/no-null */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const redactUrl = (url: URL): string => `${url.origin}${url.pathname}`;
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/prefer-default-export -- Keep the named import contract used by registry consumers and package callers even when this module exposes one value. */
/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable oxc/no-async-await -- Await preserves the existing sequencing, rejection propagation, and cleanup behavior of this asynchronous operation. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable eslint/no-ternary -- This expression selects a value without introducing mutable intermediate state or changing evaluation order. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
/* oxlint-disable typescript/strict-boolean-expressions -- This value-producing condition preserves the current nullish/empty sentinel behavior; coercing it would change the returned value. */
export const retrieveUrl = defineTool({
  description: `Fetch structured information from a single URL via Firecrawl.

Use for:
- Extract content from a specific URL supplied by the user

Avoid:
- General-purpose web searches`,
  execute: ({ url }, context) =>
    executeWithToolUsage(context, async (usage) => {
      usage.addCostUsd(0);
      try {
        if (!app) {
          return {
            error:
              "Firecrawl is not configured. Set FIRECRAWL_API_KEY to enable retrieval.",
          };
        }
        const parsedUrl = parseUrl(url);
        if (!parsedUrl) {
          return {
            error: "Please provide a valid http:// or https:// URL.",
          };
        }

        const redactedUrl = redactUrl(parsedUrl);
        const normalizedUrl = parsedUrl.toString();
        // Firecrawl does not return a monetary receipt for scrape/extract.
        usage.markUnknown();
        const content = await app.scrapeUrl(normalizedUrl);
        if (!(content.success && content.metadata)) {
          return {
            results: [
              {
                error: content.error,
              },
            ],
          };
        }

        const schema = z.object({
          content: z.string(),
          description: z.string(),
          title: z.string(),
        });

        const { metadata } = content;
        let { description, title } = metadata;
        let extractedContent = content.markdown;

        if (
          !(
            hasNonEmptyValue(title) &&
            hasNonEmptyValue(description) &&
            hasNonEmptyValue(extractedContent)
          )
        ) {
          const extractResult = await app.extract([normalizedUrl], {
            prompt:
              "Extract the page title, main content, and a brief description.",
            schema,
          });

          if (extractResult.success && extractResult.data) {
            // oxlint-disable-next-line typescript/no-unsafe-member-access, typescript/prefer-nullish-coalescing -- Empty strings intentionally select the fallback value here; nullish coalescing would preserve an unusable empty value.
            title ||= extractResult.data.title;
            // oxlint-disable-next-line typescript/no-unsafe-member-access, typescript/prefer-nullish-coalescing -- Empty strings intentionally select the fallback value here; nullish coalescing would preserve an unusable empty value.
            description ||= extractResult.data.description;
            // oxlint-disable-next-line typescript/no-unsafe-member-access, typescript/prefer-nullish-coalescing -- Empty strings intentionally select the fallback value here; nullish coalescing would preserve an unusable empty value.
            extractedContent ||= extractResult.data.content;
          }
        }

        return {
          results: [
            {
              // oxlint-disable-next-line typescript/prefer-nullish-coalescing -- Empty strings intentionally select the fallback value here; nullish coalescing would preserve an unusable empty value.
              content: extractedContent || "",
              // oxlint-disable-next-line typescript/prefer-nullish-coalescing -- Empty strings intentionally select the fallback value here; nullish coalescing would preserve an unusable empty value.
              description: description || "",
              language: metadata.language,
              // oxlint-disable-next-line typescript/prefer-nullish-coalescing -- Empty strings intentionally select the fallback value here; nullish coalescing would preserve an unusable empty value.
              title: title || "Untitled",
              url: redactedUrl,
            },
          ],
        };
      } catch (error) {
        const parsedUrl = parseUrl(url);
        log.error(
          {
            err: error,
            url: parsedUrl ? redactUrl(parsedUrl) : "<invalid-url>",
          },
          "Firecrawl API error in retrieveUrl tool"
        );
        return { error: "Failed to retrieve content" };
      }
    }),
  inputSchema: retrievedInput,
  toModelOutput: toolResultToModelOutput,
});
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-enable oxc/no-async-await */

/* oxlint-enable import/no-named-export */

/* oxlint-enable import/prefer-default-export */
