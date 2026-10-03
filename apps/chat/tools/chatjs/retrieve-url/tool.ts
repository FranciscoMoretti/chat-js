import FirecrawlApp from "@mendable/firecrawl-js";
import { defineTool } from "eve/tools";
import { z } from "zod";

import { env } from "@/lib/env";
import { toolResultToModelOutput } from "@/lib/eve/tool-model-output";
import { executeWithToolUsage } from "@/lib/eve/tool-usage";
import { createModuleLogger } from "@/lib/logger";

import { retrievedInput } from "./schemas";

const log = createModuleLogger("tools/retrieve-url");

const app = env.FIRECRAWL_API_KEY
  ? new FirecrawlApp({ apiKey: env.FIRECRAWL_API_KEY })
  : null;

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

const redactUrl = (url: URL): string => `${url.origin}${url.pathname}`;

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

        if (!(title && description && extractedContent)) {
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
