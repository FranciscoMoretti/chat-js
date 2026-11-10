import type { ReadonlyEveMessagePart } from "../../../chat/lib/eve/readonly-message-types";
import { sampleDocument, sampleDocuments } from "./preview-documents";

type ToolExample = Pick<
  Extract<ReadonlyEveMessagePart, { type: "tool" }>,
  "input" | "output" | "label"
>;

const documentExample = (kind: keyof typeof sampleDocuments): ToolExample => {
  const document = sampleDocuments[kind];
  return {
    label: `Create ${kind} document`,
    input: { title: document.title, content: document.content, fileIds: [] },
    output: {
      ...sampleDocument,
      ...document,
      result: `Created ${document.title}.`,
    },
  };
};

// Fixtures only: the scaffold's validating renderers own all presentation.
// The catalog coverage test requires an example when a built-in tool is added.
export const toolExamples: Readonly<Partial<Record<string, ToolExample>>> = {
  generateImage: {
    label: "Generate image",
    input: { prompt: "A minimal landscape with rolling green hills" },
    output: {
      prompt: "A minimal landscape with rolling green hills",
      imageUrl: "/create/samples/landscape.svg",
    },
  },
  // MDN CC0 sample, served locally so preview playback needs no external service.
  // Source: https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4
  generateVideo: {
    label: "Generate video",
    input: { prompt: "A close-up of flowers moving in the breeze" },
    output: {
      prompt: "A close-up of flowers moving in the breeze",
      videoUrl: "/create/samples/flowers.mp4",
    },
  },
  codeExecution: {
    label: "Calculate launch budget",
    input: {
      code: "costs = [120, 80, 50]\nprint('Total launch budget: $' + str(sum(costs)))",
      language: "python",
      title: "Launch budget",
    },
    output: { chart: "", message: "Total launch budget: $250" },
  },
  runCodeDocument: {
    label: "Run saved code",
    input: {
      documentId: sampleDocuments.code.documentId,
      revisionId: sampleDocuments.code.revisionId,
    },
    output: {
      documentId: sampleDocuments.code.documentId,
      revisionId: sampleDocuments.code.revisionId,
      chart: "",
      message: "Ready to launch!",
    },
  },
  wordCount: {
    label: "Count words",
    input: { text: "Build something good." },
    output: { words: 3, characters: 21, charactersNoSpaces: 19, sentences: 1 },
  },
  webSearch: {
    label: "Search the web",
    input: {
      search_queries: [{ query: "building a ChatJS app", maxResults: 2 }],
      exclude_domains: null,
      searchDepth: null,
      topics: null,
    },
    output: {
      searches: [
        {
          query: { query: "building a ChatJS app", maxResults: 2 },
          results: [
            {
              title: "ChatJS documentation",
              url: "https://chatjs.dev/docs",
              content:
                "Build your AI app with configurable plugins, tools and providers.",
            },
            {
              title: "ChatJS on GitHub",
              url: "https://github.com/FranciscoMoretti/chat-js",
              content: "Explore the source and make the app your own.",
            },
          ],
        },
      ],
    },
  },
  retrieveUrl: {
    label: "Read a page",
    input: { url: "https://chatjs.dev/docs" },
    output: {
      results: [
        {
          url: "https://chatjs.dev/docs",
          title: "ChatJS documentation",
          description: "The building blocks for your AI app",
          content:
            "Choose your appearance, plugins and AI tools, then configure the services that power your app.",
          language: "en",
        },
      ],
    },
  },
  getWeather: {
    label: "Get weather",
    input: { latitude: 51.5, longitude: -0.12 },
    output: {
      current: { interval: 900, temperature_2m: 20, time: "2026-09-08T12:00" },
      current_units: {
        interval: "seconds",
        temperature_2m: "°C",
        time: "iso8601",
      },
      daily: {
        sunrise: ["2026-09-08T06:00"],
        sunset: ["2026-09-08T19:00"],
        time: ["2026-09-08"],
      },
      daily_units: { sunrise: "iso8601", sunset: "iso8601", time: "iso8601" },
      hourly: {
        temperature_2m: [16, 17, 18, 20, 21, 20, 19, 18],
        time: Array.from(
          { length: 8 },
          (_, index) => `2026-09-08T${10 + index}:00`
        ),
      },
      hourly_units: { temperature_2m: "°C", time: "iso8601" },
      elevation: 0,
      generationtime_ms: 0,
      latitude: 51.5,
      longitude: -0.12,
      timezone: "UTC",
      timezone_abbreviation: "UTC",
      utc_offset_seconds: 0,
    },
  },
  createTextDocument: documentExample("text"),
  createCodeDocument: documentExample("code"),
  createSheetDocument: documentExample("sheet"),
  readDocument: {
    label: "Read launch notes",
    input: { documentId: sampleDocument.documentId },
    output: { ...sampleDocument, fileIds: [] },
  },
  deleteDocument: {
    label: "Delete a draft document",
    input: {
      documentId: "00000000-0000-4000-8000-000000000009",
      expectedRevisionId: "00000000-0000-4000-8000-000000000010",
      title: "Old draft",
    },
    output: { status: "success", result: "Deleted Old draft." },
  },
  deepResearch: {
    label: "Research a launch plan",
    input: {},
    output: { ...sampleDocument, format: "report" },
  },
};
