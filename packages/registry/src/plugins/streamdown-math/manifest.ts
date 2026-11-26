import { definePluginItem } from "../define-item";

export const streamdownMathItem = definePluginItem({
  name: "streamdown-math",
  title: "Math equations",
  description: "Typeset LaTeX equations in Markdown responses with KaTeX.",
  dependencies: ["@streamdown/math", "katex"],
  files: [
    {
      path: "src/plugins/streamdown-math/src/chat-ui.ts",
      target: "~/chatjs/plugins/streamdown-math/chat-ui.ts",
      type: "registry:file",
    },
  ],
});
