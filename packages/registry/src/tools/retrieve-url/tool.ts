import FirecrawlApp from "@mendable/firecrawl-js";
import { tool } from "ai";
import { z } from "zod";
import { env } from "@/lib/env";
import { createModuleLogger } from "@/lib/logger";

type ToolEnvVars = {
  description?: string;
  options: string[][];
}[];

export const toolEnvVars: ToolEnvVars = [
  {
    description: "FIRECRAWL_API_KEY",
    options: [["FIRECRAWL_API_KEY"]],
  },
];

const log = createModuleLogger("tools/retrieve-url");

const app = env.FIRECRAWL_API_KEY
  ? new FirecrawlApp({ apiKey: env.FIRECRAWL_API_KEY })
  : null;

function parseUrl(url: string): URL | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function redactUrl(url: URL): string {
  return `${url.origin}${url.pathname}`;
}

export const retrieveUrl = tool({
  description: `Fetch structured information from a single URL via Firecrawl.

Use for:
- Extract content from a specific URL supplied by the user

Avoid:
- General-purpose web searches`,
  inputSchema: z.object({
    url: z.string().describe("The URL to retrieve the information from."),
  }),
  execute: async ({ url }: { url: string }) => {
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
        title: z.string(),
        content: z.string(),
        description: z.string(),
      });

      let title = content.metadata.title;
      let description = content.metadata.description;
      let extractedContent = content.markdown;

      if (!(title && description && extractedContent)) {
        const extractResult = await app.extract([normalizedUrl], {
          prompt:
            "Extract the page title, main content, and a brief description.",
          schema,
        });

        if (extractResult.success && extractResult.data) {
          title = title || extractResult.data.title;
          description = description || extractResult.data.description;
          extractedContent = extractedContent || extractResult.data.content;
        }
      }

      return {
        results: [
          {
            title: title || "Untitled",
            content: extractedContent || "",
            url: redactedUrl,
            description: description || "",
            language: content.metadata.language,
          },
        ],
      };
    } catch (error) {
      const parsedUrl = parseUrl(url);
      log.error(
        { err: error, url: parsedUrl ? redactUrl(parsedUrl) : "<invalid-url>" },
        "Firecrawl API error in retrieveUrl tool"
      );
      return { error: "Failed to retrieve content" };
    }
  },
});
