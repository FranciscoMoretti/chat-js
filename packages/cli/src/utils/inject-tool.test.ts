import { describe, expect, it } from "bun:test";
import {
  createEmptyToolsTemplate,
  createEmptyUiTemplate,
  injectTool,
} from "./inject-tool";

describe("registry index injection", () => {
  it("adds tool and renderer entries with the configured alias", () => {
    const toolsAlias = "~/custom-tools";
    const result = injectTool({
      toolsSource: createEmptyToolsTemplate(toolsAlias),
      uiSource: createEmptyUiTemplate(),
      name: "word-count",
      toolsAlias,
    });

    expect(result.toolsSource).toContain(
      'import { wordCount } from "~/custom-tools/word-count/tool";'
    );
    expect(result.toolsSource).toContain("  wordCount,");
    expect(result.uiSource).toContain(
      'import { WordCountRenderer } from "~/custom-tools/word-count/renderer";'
    );
    expect(result.uiSource).toContain(
      '  "tool-wordCount": WordCountRenderer,'
    );
  });
});
