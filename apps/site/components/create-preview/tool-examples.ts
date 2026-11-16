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
  attach_workspace_file: {
    label: "Attach workspace file",
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
