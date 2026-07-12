// Marker pairs that bound the CLI-managed sections in the registry files.
const MARKERS = {
  toolImports: {
    open: "// [chatjs-registry:tool-imports]",
    close: "// [/chatjs-registry:tool-imports]",
  },
  tools: {
    open: "// [chatjs-registry:tools]",
    close: "// [/chatjs-registry:tools]",
  },
  uiImports: {
    open: "// [chatjs-registry:ui-imports]",
    close: "// [/chatjs-registry:ui-imports]",
  },
  ui: {
    open: "// [chatjs-registry:ui]",
    close: "// [/chatjs-registry:ui]",
  },
} as const;

/** "word-count" → "wordCount" */
function toCamelCase(kebab: string): string {
  return kebab.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

/** "word-count" → "WordCount" */
function toPascalCase(kebab: string): string {
  const camel = toCamelCase(kebab);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

/**
 * Insert `newLines` just before `closeMarker` in `source`.
 * Returns source unchanged if `idempotencyCheck` is already present
 * between the open and close markers.
 */
function injectIntoBlock(
  source: string,
  openMarker: string,
  closeMarker: string,
  newLines: string,
  idempotencyCheck: string
): string {
  const openIdx = source.indexOf(openMarker);
  const closeIdx = source.indexOf(closeMarker);

  if (openIdx === -1 || closeIdx === -1) {
    throw new Error(
      `Registry markers not found: ${openMarker}\n` +
        `Ensure the registry index contains the expected marker comments.`
    );
  }

  const block = source.slice(openIdx, closeIdx);
  if (block.includes(idempotencyCheck)) {
    return source; // already present — nothing to do
  }

  // Insert before the entire close-marker line (not mid-line after any leading
  // whitespace) so the injected lines and the marker keep correct indentation.
  const lineStart = source.lastIndexOf("\n", closeIdx) + 1;
  return source.slice(0, lineStart) + newLines + source.slice(lineStart);
}

/**
 * Inject a tool's imports and registrations into the managed registry files.
 * Returns the updated source strings (pure — no file I/O).
 *
 * @param toolsSource Current contents of the managed tools file
 * @param uiSource    Current contents of the managed UI file
 * @param name      Kebab-case tool name, e.g. "word-count"
 * @param toolsAlias  Import alias, e.g. "@/tools"
 */
export function injectTool(
  {
    toolsSource,
    uiSource,
    name,
    toolsAlias,
  }: {
    toolsSource: string;
    uiSource: string;
    name: string;
    toolsAlias: string;
  }
): { toolsSource: string; uiSource: string } {
  const camel = toCamelCase(name);
  const pascal = toPascalCase(name);
  const rendererName = `${pascal}Renderer`;

  // 1. Server tool imports block
  const toolImportLines =
    `import { ${camel} } from "${toolsAlias}/${name}/tool";\n`;
  toolsSource = injectIntoBlock(
    toolsSource,
    MARKERS.toolImports.open,
    MARKERS.toolImports.close,
    toolImportLines,
    toolImportLines.trim()
  );

  // 2. Server tools object block
  const toolLine = `  ${camel},\n`;
  toolsSource = injectIntoBlock(
    toolsSource,
    MARKERS.tools.open,
    MARKERS.tools.close,
    toolLine,
    toolLine.trim()
  );

  // 3. Client UI imports block
  const uiImportLines =
    `import { ${rendererName} } from "${toolsAlias}/${name}/renderer";\n`;
  uiSource = injectIntoBlock(
    uiSource,
    MARKERS.uiImports.open,
    MARKERS.uiImports.close,
    uiImportLines,
    uiImportLines.trim()
  );

  // 4. Client UI registry block
  const uiLine = `  "tool-${camel}": ${rendererName},\n`;
  uiSource = injectIntoBlock(
    uiSource,
    MARKERS.ui.open,
    MARKERS.ui.close,
    uiLine,
    uiLine.trim()
  );

  return { toolsSource, uiSource };
}

/** Template used when the managed tools file doesn't exist yet. */
export function createEmptyToolsTemplate(
  toolsAlias = "@/tools/chatjs"
): string {
  return (
    `// Server-side tools installed via \`chatjs add\`.\n` +
    `// This file is fully managed by the CLI — do not edit manually.\n` +
    `\n` +
    `import {\n` +
    `  createRegistryTools,\n` +
    `  type ToolRuntimeContext,\n` +
    `} from "${toolsAlias}/_shared/lib/runtime";\n` +
    `\n` +
    `${MARKERS.toolImports.open}\n` +
    `${MARKERS.toolImports.close}\n` +
    `\n` +
    `export const toolEntries = {\n` +
    `  ${MARKERS.tools.open}\n` +
    `  ${MARKERS.tools.close}\n` +
    `} as const;\n` +
    `\n` +
    `export function createTools(ctx: ToolRuntimeContext) {\n` +
    `  return createRegistryTools(toolEntries, ctx);\n` +
    `}\n`
  );
}

/** Template used when the managed UI file doesn't exist yet. */
export function createEmptyUiTemplate(): string {
  return (
    `// Client-side tool renderers installed via \`chatjs add\`.\n` +
    `// This file is fully managed by the CLI — do not edit manually.\n` +
    `\n` +
    `${MARKERS.uiImports.open}\n` +
    `${MARKERS.uiImports.close}\n` +
    `\n` +
    `export const ui = {\n` +
    `  ${MARKERS.ui.open}\n` +
    `  ${MARKERS.ui.close}\n` +
    `};\n`
  );
}
