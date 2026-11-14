import FirecrawlApp from "@mendable/firecrawl-js";
import { defineTool } from "eve/tools";
import { readToolEnvironment } from "./retrieve-url-env";
import { retrievedInput, retrievedResult } from "./schemas";
import { z } from "zod";

type RetrieveUrlInput = Readonly<z.infer<typeof retrievedInput>>;
type RetrieveUrlContext = Readonly<{
  abortSignal: Readonly<AbortSignal>;
}>;
const hasNonEmptyValue = (value: string | null | undefined): value is string =>
  typeof value === "string" && value !== "";

const extractedPage = z.object({
  content: z.string(),
  description: z.string(),
  title: z.string(),
});
const extractedText = z.preprocess(
  (value) => (typeof value === "string" ? value : ""),
  z.string()
);
const extractedPageFallback = z.object({
  content: extractedText,
  description: extractedText,
  title: extractedText,
});

const createClient = (): FirecrawlApp | null => {
  const env = readToolEnvironment();
  return hasNonEmptyValue(env.FIRECRAWL_API_KEY)
    ? new FirecrawlApp({ apiKey: env.FIRECRAWL_API_KEY })
    : null;
};

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

const retrieveContent = async (url: string, signal: Readonly<AbortSignal>) => {
  signal.throwIfAborted();
  try {
    const app = createClient();
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
    signal.throwIfAborted();
    if (!(content.success && content.metadata)) {
      return {
        results: [
          {
            error: "Failed to retrieve content",
          },
        ],
      };
    }

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
        schema: extractedPage,
      });

      signal.throwIfAborted();
      if (
        extractResult.success &&
        extractResult.data !== undefined &&
        extractResult.data !== null
      ) {
        const extracted = extractedPageFallback.safeParse(extractResult.data);
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
  } catch {
    signal.throwIfAborted();
    return {
      error: "Failed to retrieve content",
    };
  }
};

export const retrieveUrl = defineTool({
  description: `Fetch structured information from a single URL via Firecrawl.

Use for:
- Extract content from a specific URL supplied by the user

Avoid:
- General-purpose web searches`,
  execute: async ({ url }: RetrieveUrlInput, context: RetrieveUrlContext) =>
    retrievedResult.parse(await retrieveContent(url, context.abortSignal)),
  inputSchema: retrievedInput,
  outputSchema: retrievedResult,
});
