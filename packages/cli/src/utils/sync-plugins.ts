import { assertCurrentInstallationLayout } from "./installation-layout";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import type { PluginDefinition } from "../../../registry/metadata";
import { readInstalledPlugins } from "./installed-plugins";
import { planDatabaseSchemas } from "./sync-database";
import { generatedRegistrationSource } from "./generated-registration-source";
import { preflight } from "./preflight";
import { initializeObservability } from "./sync-observability";
import { pluginItems } from "../../../registry/src/plugins/catalog";

type ReadonlyNative<Value> = Value extends (
  ...args: readonly never[]
) => unknown
  ? Value
  : Value extends object
    ? { readonly [Key in keyof Value]: ReadonlyNative<Value[Key]> }
    : Value;

interface ContributionBinding {
  binding: string;
  bindings: ts.NamedImportBindings | undefined;
  specifier: ts.ImportSpecifier | undefined;
}

const contributionBinding = (
  parsed: ReadonlyNative<ts.SourceFile>,
  marker: string,
  symbol: string
): ContributionBinding => {
  const imports = parsed.statements.filter(ts.isImportDeclaration);
  const imported = imports.find(
    (node: ReadonlyNative<ts.ImportDeclaration>): boolean =>
      ts.isStringLiteral(node.moduleSpecifier) &&
      node.moduleSpecifier.text === marker &&
      (!node.importClause || !ts.isTypeOnlyImportDeclaration(node.importClause))
  );
  const importClause = imported && imported.importClause;
  const bindings = importClause && importClause.namedBindings;
  const namedBindings =
    bindings && ts.isNamedImports(bindings) ? bindings.elements : [];
  const specifier = namedBindings.find(
    (item: ReadonlyNative<ts.ImportSpecifier>): boolean =>
      !item.isTypeOnly && (item.propertyName ?? item.name).text === symbol
  );
  if (bindings && ts.isNamespaceImport(bindings)) {
    return { binding: `${bindings.name.text}.${symbol}`, bindings, specifier };
  }
  return {
    binding: (specifier && specifier.name.text) ?? symbol,
    bindings,
    specifier,
  };
};
interface PlannedContribution {
  content: string;
  file: string;
}
interface SourceEdit {
  readonly start: number;
  readonly text: string;
}
const LAST_ELEMENT = -1;
const CLOSING_DELIMITER_WIDTH = 1;
const SOURCE_START = 0;

// Plan both application-owned UI edits before writing any registrations.
const planContribution = async (
  file: string,
  name: string,
  symbol: string,
  marker: string,
  id: string | readonly string[],
  entry: (binding: string) => string,
  sourceOverride?: string
): Promise<PlannedContribution> => {
  const source = sourceOverride ?? (await readFile(file, "utf-8"));
  const parsed = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true
  );
  const declaration = parsed.statements
    .filter(ts.isVariableStatement)
    .flatMap(
      (statement: ReadonlyNative<ts.VariableStatement>) =>
        statement.declarationList.declarations
    )
    .find(
      (item: ReadonlyNative<ts.VariableDeclaration>): boolean =>
        item.name.getText(parsed) === name
    );
  if (
    !declaration ||
    !declaration.initializer ||
    !ts.isArrayLiteralExpression(declaration.initializer)
  ) {
    throw new Error(
      `Add the plugin contribution to ${file} manually: ${name} is no longer a literal array. Then run chat-js sync. To retry automatic UI integration, restore a literal array and retry chat-js add.`
    );
  }
  const array = declaration.initializer;
  const contributionIds = typeof id === "string" ? [id] : id;
  const { binding, bindings, specifier } = contributionBinding(
    parsed,
    marker,
    symbol
  );
  // The array determines presence; an unused import is not a contribution.
  if (
    array.elements.some(
      (item: ReadonlyNative<ts.Expression>): boolean =>
        item.getText(parsed) === binding ||
        (ts.isSpreadElement(item) &&
          item.expression.getText(parsed) === `${binding}().${name}`) ||
        (ts.isObjectLiteralExpression(item) &&
          item.properties.some(
            (prop: ReadonlyNative<ts.ObjectLiteralElementLike>): boolean =>
              ts.isPropertyAssignment(prop) &&
              ((prop.name
                .getText(parsed)
                .replaceAll('"', "")
                .replaceAll("'", "") === "id" &&
                ts.isStringLiteral(prop.initializer) &&
                contributionIds.includes(prop.initializer.text)) ||
                (prop.name.getText(parsed) === "Component" &&
                  prop.initializer.getText(parsed) === binding))
          ))
    )
  ) {
    return { content: source, file };
  }
  const edits: SourceEdit[] = [];
  if (!specifier && !(bindings && ts.isNamespaceImport(bindings))) {
    // Avoid overwriting a user binding with the same name from another module.
    const identifiers = new Set<string>();
    const collect = (node: ReadonlyNative<ts.Node>): void => {
      if (ts.isIdentifier(node)) {
        identifiers.add(node.text);
      }
      ts.forEachChild(node, collect);
    };
    collect(parsed);
    if (identifiers.has(symbol)) {
      throw new Error(
        `Cannot import ${symbol} in ${file}: that name is already used. Add the plugin contribution manually and run chat-js sync.`
      );
    }
    if (bindings && ts.isNamedImports(bindings)) {
      const last = bindings.elements.at(LAST_ELEMENT);
      if (last && !bindings.elements.hasTrailingComma) {
        edits.push({ start: last.end, text: "," });
      }
      edits.push({
        start: bindings.end - CLOSING_DELIMITER_WIDTH,
        text: ` ${symbol} `,
      });
    } else {
      const lastImport = parsed.statements.findLast(
        (node: ReadonlyNative<ts.Statement>): boolean =>
          ts.isImportDeclaration(node) ||
          (ts.isExpressionStatement(node) &&
            ts.isStringLiteral(node.expression))
      );
      const importEnd = (lastImport && lastImport.end) ?? SOURCE_START;
      edits.push({
        start: importEnd,
        text: `\nimport { ${symbol} } from "${marker}";\n`,
      });
    }
  }
  edits.push({
    start: array.end - CLOSING_DELIMITER_WIDTH,
    text: `\n  ${entry(binding)},\n`,
  });
  const last = array.elements.at(LAST_ELEMENT);
  if (last && !array.elements.hasTrailingComma) {
    edits.push({ start: last.end, text: "," });
  }
  let content = source;
  for (const edit of edits.toSorted(
    (leftEdit: SourceEdit, rightEdit: SourceEdit): number =>
      rightEdit.start - leftEdit.start
  )) {
    content =
      content.slice(SOURCE_START, edit.start) +
      edit.text +
      content.slice(edit.start);
  }
  return { content, file };
};

const pluginRegistrationTargets = [
  "installed",
  "installed-routers",
  "installed-uploads",
  "installed-layout",
  "installed-instrumentation",
  "installed-database",
  "installed-chat",
  "installed-chat-ui",
].map((name) => `composition/generated/${name}.ts`);

const assertPluginDependencies = (
  plugins: readonly PluginDefinition[]
): void => {
  const ids = new Set(plugins.map((plugin) => plugin.id));
  for (const plugin of plugins) {
    for (const dependency of plugin.requiresPlugins ?? []) {
      if (!ids.has(dependency)) {
        throw new Error(
          `${plugin.id} requires installed plugin: ${dependency}`
        );
      }
    }
  }
};

const assertUniqueContributions = (
  plugins: readonly PluginDefinition[]
): void => {
  const routers = new Set(["credits", "eve", "settings"]);
  const controls = new Set([
    "canvas",
    "web-search",
    "deep-research",
    "image",
    "video",
  ]);
  const settings = new Set(["general", "models"]);
  let uploads = false;
  for (const plugin of plugins) {
    for (const [keys, seen, label] of [
      [plugin.server?.routers ?? [], routers, "router"],
      [plugin.client?.composerControls ?? [], controls, "composer control"],
      [plugin.client?.settingsItems ?? [], settings, "settings item"],
    ] as const) {
      for (const key of keys) {
        if (seen.has(key)) {
          throw new Error(`Duplicate or reserved plugin ${label}: ${key}`);
        }
        seen.add(key);
      }
    }
    if (plugin.client?.uploads) {
      if (uploads) {
        throw new Error("Only one plugin may supply attachment uploads.");
      }
      uploads = true;
    }
  }
  assertPluginDependencies(plugins);
};

const imports = (
  selected: readonly PluginDefinition[],
  side: "server" | "client"
): string =>
  selected
    .map(
      (plugin, index) =>
        `import { ${plugin[side]?.export} as plugin${index} } from "@/plugins/${plugin.id}/${side}-plugin";`
    )
    .join("\n");

const syncPlugins = async (
  cwd: string,
  options: Readonly<{
    addUi?: boolean | readonly string[];
    expected?: readonly string[];
  }> = {}
): Promise<void> => {
  await assertCurrentInstallationLayout(cwd);
  await preflight(cwd, [
    ...pluginRegistrationTargets,
    "composer-controls.ts",
    "settings-items.ts",
  ]);
  const plugins = await readInstalledPlugins(cwd);
  for (const id of options.expected ?? []) {
    if (!plugins.some((plugin) => plugin.id === id)) {
      throw new Error(`Missing plugin descriptor: plugins/${id}/chatjs.json`);
    }
  }
  assertUniqueContributions(plugins);
  const databaseSchemas = await planDatabaseSchemas(
    cwd,
    plugins.map((plugin) => plugin.id)
  );
  const ui: PlannedContribution[] = [];
  for (const plugin of plugins) {
    if (
      !plugin.client ||
      !(
        options.addUi === true ||
        (Array.isArray(options.addUi) && options.addUi.includes(plugin.id))
      )
    ) {
      continue;
    }
    for (const [name, file, ids] of [
      [
        "composerControls",
        "composer-controls.ts",
        plugin.client.composerControls,
      ],
      ["settingsItems", "settings-items.ts", plugin.client.settingsItems],
    ] as const) {
      if (ids.length === 0) {
        continue;
      }
      const target = path.join(cwd, file);
      const previous = ui.find((edit) => edit.file === target);
      // oxlint-disable-next-line no-await-in-loop -- Each plugin extends the previous planned edit of this application-owned array.
      const edit = await planContribution(
        target,
        name,
        plugin.client.export,
        `@/plugins/${plugin.id}/client-plugin`,
        ids,
        (binding) => `...${binding}().${name}`,
        previous?.content
      );
      if (previous) {
        previous.content = edit.content;
      } else {
        ui.push(edit);
      }
    }
  }
  const routerPlugins = plugins.filter(
    (plugin) => (plugin.server?.routers.length ?? 0) > 0
  );
  const instrumented = plugins.filter(
    (plugin) => plugin.server?.instrumentation
  );
  const layout = plugins.filter((plugin) => plugin.client?.layout);
  const uploads = plugins.filter((plugin) => plugin.client?.uploads);
  const chat = plugins.filter((plugin) => plugin.chat);
  const chatUi = plugins.filter((plugin) => plugin.client?.chat);
  const contents = [
    [
      "installed-chat",
      `${chat.map((plugin, index) => `import { ${plugin.chat?.export} as chat${index} } from "@/plugins/${plugin.id}/chat";`).join("\n")}\nimport type { ChatServerIntegration } from "@/lib/chat-plugin-contracts";\nexport const installedChatPlugins: readonly ChatServerIntegration[] = [${chat.map((_, index) => `chat${index}`).join(", ")}];`,
    ],
    [
      "installed-chat-ui",
      `${imports(chatUi, "client")}\nimport type { ChatClientIntegration } from "@/lib/chat-plugin-contracts";\nexport const installedChatUi: readonly { id: string; chat: ChatClientIntegration }[] = [${chatUi.map((plugin, index) => `{ id: "${plugin.id}", chat: plugin${index}().chat }`).join(", ")}];`,
    ],
    [
      "installed",
      `export const installedPlugins: ReadonlySet<string> = new Set(${plugins.length > 0 ? JSON.stringify(plugins.map((plugin) => plugin.id)) : ""});`,
    ],
    [
      "installed-routers",
      `${imports(routerPlugins, "server")}\nimport type { InstalledRouters } from "@/lib/installation-contracts";\nexport const installedRouters = { ${routerPlugins.flatMap((plugin, index) => plugin.server?.routers.map((key) => `${key}: plugin${index}().routers.${key}`) ?? []).join(", ")} } satisfies InstalledRouters;`,
    ],
    [
      "installed-instrumentation",
      `${imports(instrumented, "server")}\nimport type { InstrumentationRegistration } from "@/lib/installation-contracts";\nexport const installedInstrumentation: readonly InstrumentationRegistration[] = [${instrumented.map((_, index) => `plugin${index}().instrumentation`).join(", ")}];`,
    ],
    [
      "installed-layout",
      `${imports(layout, "client")}\nimport type { InstalledLayoutComponent } from "@/lib/installation-contracts";\nexport const installedLayoutComponents: readonly { id: string; Component: InstalledLayoutComponent }[] = [${layout.map((plugin, index) => `{ id: "${plugin.id}", Component: plugin${index}().layout }`).join(", ")}];`,
    ],
    [
      "installed-uploads",
      `${imports(uploads, "client")}\nimport type { AttachmentUploadIntegration } from "@/lib/installation-contracts";\nexport const attachmentUploads: AttachmentUploadIntegration = ${uploads.length > 0 ? "plugin0().uploads" : "{ controls: [], useUploads: () => ({ uploadQueue: [] }) }"};`,
    ],
  ] as const;
  await mkdir(path.join(cwd, "composition/generated"), { recursive: true });
  await Promise.all([
    writeFile(
      path.join(cwd, "composition/generated/installed-database.ts"),
      databaseSchemas
    ),
    ...contents.map(async ([name, content]) => {
      await writeFile(
        path.join(cwd, `composition/generated/${name}.ts`),
        generatedRegistrationSource(
          `// Generated by chat-js sync.\n${content}\n`
        )
      );
    }),
    ...ui.map(async ({ file, content }) => {
      await writeFile(file, content);
    }),
  ]);
};

// Only creation resets demo contributions. Add/sync preserve app-owned order.
const initializePluginUi = async (cwd: string): Promise<void> => {
  for (const [file, name] of [
    ["composer-controls.ts", "composerControls"],
    ["settings-items.ts", "settingsItems"],
  ]) {
    const location = path.join(cwd, file);
    // oxlint-disable-next-line no-await-in-loop -- Each application-owned file is planned and written independently.
    const source = await readFile(location, "utf-8");
    const parsed = ts.createSourceFile(
      file,
      source,
      ts.ScriptTarget.Latest,
      true
    );
    const bindings = new Set<string>();
    const edits: { start: number; end: number; text: string }[] = [];
    for (const node of parsed.statements) {
      if (
        ts.isImportDeclaration(node) &&
        ts.isStringLiteral(node.moduleSpecifier) &&
        node.moduleSpecifier.text.startsWith("@/plugins/")
      ) {
        const named = node.importClause?.namedBindings;
        if (named && ts.isNamedImports(named)) {
          for (const specifier of named.elements) {
            bindings.add(specifier.name.text);
          }
        }
        if (named && ts.isNamespaceImport(named)) {
          bindings.add(named.name.text);
        }
        edits.push({ start: node.getFullStart(), end: node.end, text: "" });
      }
    }
    const usesPlugin = (node: ts.Node): boolean => {
      if (ts.isIdentifier(node) && bindings.has(node.text)) {
        return true;
      }
      return ts.forEachChild(node, usesPlugin) === true;
    };
    for (const node of parsed.statements) {
      if (!ts.isVariableStatement(node)) {
        continue;
      }
      for (const declaration of node.declarationList.declarations) {
        if (
          declaration.name.getText(parsed) !== name ||
          !declaration.initializer ||
          !ts.isArrayLiteralExpression(declaration.initializer)
        ) {
          continue;
        }
        const array = declaration.initializer;
        edits.push({
          start: array.getStart(parsed),
          end: array.end,
          text: `[\n${array.elements
            .filter((entry) => !usesPlugin(entry))
            .map((entry) => `${entry.getText(parsed)},`)
            .join("\n")}\n]`,
        });
      }
    }
    let content = source;
    for (const edit of edits.toSorted((a, b) => b.start - a.start)) {
      content =
        content.slice(0, edit.start) + edit.text + content.slice(edit.end);
    }
    // oxlint-disable-next-line no-await-in-loop -- Finish this file before resetting the next creation-only composition file.
    await writeFile(location, content);
  }
  await initializeObservability(cwd);
  // The reference preset's plugin sources, including adapters, are explicit.
  await Promise.all(
    pluginItems.flatMap((item) =>
      (item.files ?? []).map(async (file) => {
        if (file.target?.startsWith("~/") === true) {
          await rm(path.join(cwd, file.target.slice(2)), { force: true });
        }
      })
    )
  );
  await rm(path.join(cwd, "plugins"), { force: true, recursive: true });
  await syncPlugins(cwd);
};

export { initializePluginUi, pluginRegistrationTargets, syncPlugins };
