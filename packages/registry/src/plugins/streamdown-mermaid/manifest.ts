import { definePluginItem } from "../define-item";

export const streamdownMermaidItem = definePluginItem({
  name: "streamdown-mermaid",
  title: "Mermaid diagrams",
  description: "Render Mermaid code fences as diagrams in Markdown responses.",
  dependencies: ["@streamdown/mermaid"],
  files: [
    {
      path: "src/plugins/streamdown-mermaid/src/chat-ui.ts",
      target: "~/chatjs/plugins/streamdown-mermaid/chat-ui.ts",
      type: "registry:file",
    },
  ],
});
