import FirecrawlApp from "@mendable/firecrawl-js";
import { defineTool } from "eve/tools";
import { env } from "@/lib/env";
import { createModuleLogger } from "@/lib/logger";
import { executeWithToolUsage } from "@/lib/eve/tool-usage";
import { retrievedInput } from "./schemas";
import { toolResultToModelOutput } from "@/lib/eve/tool-model-output";
import { z } from "zod";

type RetrieveUrlInput = Readonly<z.infer<typeof retrievedInput>>;
type RetrieveUrlContext = Readonly<{
  abortSignal: Readonly<AbortSignal>;
}>;
type RetrieveUrlUsage = Readonly<{
  addCostUsd: (cost: number) => void;
  markUnknown: () => void;
}>;

const hasNonEmptyValue = (value: string | null | undefined): value is string =>
  typeof value === "string" && value !== "";

const UNBILLED_TOOL_COST_USD = 0;
const log = createModuleLogger("tools/retrieve-url");

const app = hasNonEmptyValue(env.FIRECRAWL_API_KEY)
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

const redactUrl = (url: Readonly<Pick<URL, "origin" | "pathname">>): string =>
  `${url.origin}${url.pathname}`;

export const retrieveUrl = defineTool({
  description: `Fetch structured information from a single URL via Firecrawl.

Use for:
- Extract content from a specific URL supplied by the user

Avoid:
- General-purpose web searches`,
  execute: async ({ url }: RetrieveUrlInput, context: RetrieveUrlContext) =>
    await executeWithToolUsage(context, async (usage: RetrieveUrlUsage) => {
      usage.addCostUsd(UNBILLED_TOOL_COST_USD);
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

          if (
            extractResult.success &&
            extractResult.data !== undefined &&
            extractResult.data !== null
          ) {
            const extracted = schema
              .extend({
                content: schema.shape.content.catch(""),
                description: schema.shape.description.catch(""),
                title: schema.shape.title.catch(""),
              })
              .safeParse(extractResult.data);
            if (extracted.success) {
              title = hasNonEmptyValue(title) ? title : extracted.data.title;
              description = hasNonEmptyValue(description)
                ? description
                : extracted.data.description;
              extractedContent = hasNonEmptyValue(extractedContent)
                ? extractedContent
                : extracted.data.content;
            }
          }
        }

        return {
          results: [
            {
              content: extractedContent ?? "",
              description: description ?? "",
              language: metadata.language,
              title: hasNonEmptyValue(title) ? title : "Untitled",
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
