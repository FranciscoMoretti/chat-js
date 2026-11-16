import type { ReadonlyEveMessagePart } from "../../../chat/lib/eve/readonly-message-types";

type ToolExample = Pick<
  Extract<ReadonlyEveMessagePart, { type: "tool" }>,
  "input" | "output" | "label"
>;

// Fixtures only: the scaffold's validating renderers own all presentation.
// The catalog coverage test requires an example when a built-in tool is added.
export const toolExamples: Readonly<Partial<Record<string, ToolExample>>> = {
  import_file: {
    label: "Import a file for revision",
    input: { fileId: "sample_published_file_001", name: "launch-budget.csv" },
    output: {
      fileId: "sample_published_file_001",
      name: "launch-budget.csv",
      mediaType: "text/csv",
      size: 41,
      path: "/workspace/import-example-launch-budget.csv",
    },
  },
  publish_file: {
    label: "Publish file",
    input: { path: "/workspace/launch-budget.csv" },
    output: {
      fileId: "sample-published-file",
      name: "launch-budget.csv",
      mediaType: "text/csv",
      size: 41,
      url: "/create/samples/launch-budget.csv",
    },
  },
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
  wordCount: {
    label: "Count words",
    input: { text: "Build something good." },
    output: { words: 3, characters: 21, charactersNoSpaces: 19, sentences: 1 },
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
  deepResearch: {
    label: "Research a launch plan",
    input: { request: "Research a launch plan" },
    output: {
      path: "/workspace/research/example/report.md",
      title: "Launch research",
      format: "report",
    },
  },
};
