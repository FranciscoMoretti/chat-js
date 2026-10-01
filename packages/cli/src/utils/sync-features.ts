import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import ts from "typescript";

import { featureDefinitionSchema } from "../../../registry/metadata";
import type { FeatureDefinition } from "../../../registry/metadata";
import { attachmentUploadFiles } from "../../../registry/src/features/attachment-uploads";
import { mcpFiles } from "../../../registry/src/features/mcp";

/** Extend only when an implementation has complete installer/sync integration. */
export const assertSupportedFeatureInstallation = (
  features: readonly FeatureDefinition[]
): void => {
  const unsupported = features.filter(
    (feature) => !["mcp", "attachment-uploads"].includes(feature.id)
  );
  if (unsupported.length) {
    throw new Error(
      `Feature installation is not supported yet: ${unsupported.map((feature) => feature.id).join(", ")}. MCP and attachment uploads have installation integration.`
    );
  }
};

const exists = async (file: string) => {
  try {
    await access(file);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
};

const contributionBinding = (
  parsed: ts.SourceFile,
  marker: string,
  symbol: string
) => {
  const imports = parsed.statements.filter(ts.isImportDeclaration);
  const imported = imports.find(
    (node) =>
      ts.isStringLiteral(node.moduleSpecifier) &&
      node.moduleSpecifier.text === marker &&
      !node.importClause?.isTypeOnly
  );
  const bindings = imported?.importClause?.namedBindings;
  const specifier =
    bindings && ts.isNamedImports(bindings)
      ? bindings.elements.find(
          (item) =>
            !item.isTypeOnly && (item.propertyName ?? item.name).text === symbol
        )
      : undefined;
  const binding =
    bindings && ts.isNamespaceImport(bindings)
      ? `${bindings.name.text}.${symbol}`
      : (specifier?.name.text ?? symbol);
  return { binding, bindings, specifier };
};

// Plan both application-owned UI edits before writing any registrations.
const planContribution = async (
  file: string,
  name: string,
  symbol: string,
  marker: string,
  id: string,
  entry: (binding: string) => string,
  sourceOverride?: string
) => {
  const source = sourceOverride ?? (await readFile(file, "utf-8"));
  const parsed = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true
  );
  const declaration = parsed.statements
    .filter(ts.isVariableStatement)
    .flatMap((statement) => [...statement.declarationList.declarations])
    .find((item) => item.name.getText(parsed) === name);
  if (
    !declaration?.initializer ||
    !ts.isArrayLiteralExpression(declaration.initializer)
  ) {
    throw new Error(
      `Add the feature contribution to ${file} manually: ${name} is no longer a literal array. Then run chat-js sync. To retry automatic UI integration, restore a literal array and retry chat-js add.`
    );
  }
  const array = declaration.initializer;
  const { binding, bindings, specifier } = contributionBinding(
    parsed,
    marker,
    symbol
  );
  // The array determines presence; an unused import is not a contribution.
  if (
    array.elements.some(
      (item) =>
        item.getText(parsed) === binding ||
        item.getText(parsed) === `...${binding}.controls` ||
        (ts.isObjectLiteralExpression(item) &&
          item.properties.some(
            (prop) =>
              ts.isPropertyAssignment(prop) &&
              ((prop.name
                .getText(parsed)
                .replaceAll('"', "")
                .replaceAll("'", "") === "id" &&
                ts.isStringLiteral(prop.initializer) &&
                prop.initializer.text === id) ||
                (prop.name.getText(parsed) === "Component" &&
                  prop.initializer.getText(parsed) === binding))
          ))
    )
  ) {
    return { content: source, file };
  }
  const edits: { start: number; text: string }[] = [];
  if (!specifier && !(bindings && ts.isNamespaceImport(bindings))) {
    // Avoid overwriting a user binding with the same name from another module.
    const identifiers = new Set<string>();
    const collect = (node: ts.Node) => {
      if (ts.isIdentifier(node)) {
        identifiers.add(node.text);
      }
      ts.forEachChild(node, collect);
    };
    collect(parsed);
    if (identifiers.has(symbol)) {
      throw new Error(
        `Cannot import ${symbol} in ${file}: that name is already used. Add the feature contribution manually and run chat-js sync.`
      );
    }
    if (bindings && ts.isNamedImports(bindings)) {
      const last = bindings.elements.at(-1);
      if (last && !bindings.elements.hasTrailingComma) {
        edits.push({ start: last.end, text: "," });
      }
      edits.push({ start: bindings.end - 1, text: ` ${symbol} ` });
    } else {
      const importEnd =
        parsed.statements.findLast(
          (node) =>
            ts.isImportDeclaration(node) ||
            (ts.isExpressionStatement(node) &&
              ts.isStringLiteral(node.expression))
        )?.end ?? 0;
      edits.push({
        start: importEnd,
        text: `\nimport { ${symbol} } from "${marker}";\n`,
      });
    }
  }
  edits.push({ start: array.end - 1, text: `\n  ${entry(binding)},\n` });
  const last = array.elements.at(-1);
  if (last && !array.elements.hasTrailingComma) {
    edits.push({ start: last.end, text: "," });
  }
  let content = source;
  for (const edit of edits.toSorted((a, b) => b.start - a.start)) {
    content =
      content.slice(0, edit.start) + edit.text + content.slice(edit.start);
  }
  return { content, file };
};

const validateAttachmentUploads = async (cwd: string, expected?: boolean) => {
  const uploadDescriptor = path.join(
    cwd,
    "features/attachment-uploads/chatjs.json"
  );
  const uploads = await exists(uploadDescriptor);
  const uploadPresence = await Promise.all(
    attachmentUploadFiles.map((file) => exists(path.join(cwd, file)))
  );
  if (!uploads && (expected || uploadPresence.some(Boolean))) {
    throw new Error(
      "Attachment uploads installation is missing features/attachment-uploads/chatjs.json. Run chat-js add attachment-uploads to complete the installation."
    );
  }
  if (uploads) {
    const definition = featureDefinitionSchema.parse(
      JSON.parse(await readFile(uploadDescriptor, "utf-8"))
    );
    if (definition.id !== "attachment-uploads") {
      throw new Error(
        "Feature descriptor id must match its directory: attachment-uploads"
      );
    }
    const missing = attachmentUploadFiles.filter(
      (_, index) => !uploadPresence[index]
    );
    if (missing.length) {
      throw new Error(
        `Attachment uploads installation is incomplete. Missing: ${missing.join(", ")}. Run chat-js add attachment-uploads to restore missing files.`
      );
    }
  }
  return uploads;
};

const validateMcp = async (cwd: string, expected?: boolean) => {
  const descriptor = path.join(cwd, "features/mcp/chatjs.json");
  const mcp = await exists(descriptor);
  const presence = await Promise.all(
    mcpFiles.map((file) => exists(path.join(cwd, file)))
  );
  if (!mcp && (expected || presence.some(Boolean))) {
    throw new Error(
      "MCP installation is missing features/mcp/chatjs.json. Run chat-js add mcp to complete the installation."
    );
  }
  if (mcp) {
    const definition = featureDefinitionSchema.parse(
      JSON.parse(await readFile(descriptor, "utf-8"))
    );
    if (definition.id !== "mcp") {
      throw new Error("Feature descriptor id must match its directory: mcp");
    }
    const missing = mcpFiles.filter((_, index) => !presence[index]);
    if (missing.length > 0) {
      throw new Error(
        `MCP installation is incomplete. Missing: ${missing.join(", ")}. Run chat-js add mcp to restore the missing files.`
      );
    }
  }
  return mcp;
};

export const syncFeatures = async (
  cwd: string,
  options: {
    addUi?: boolean;
    expectedMcp?: boolean;
    expectedUploads?: boolean;
  } = {}
) => {
  const mcp = await validateMcp(cwd, options.expectedMcp);
  const uploads = await validateAttachmentUploads(cwd, options.expectedUploads);
  const ui: { content: string; file: string }[] =
    mcp && options.addUi
      ? await Promise.all([
          planContribution(
            path.join(cwd, "composer-controls.ts"),
            "composerControls",
            "ConnectorsControl",
            "@/features/mcp/composer",
            "mcp",
            (binding) => `{ Component: ${binding}, id: "mcp" }`
          ),
          planContribution(
            path.join(cwd, "settings-items.ts"),
            "settingsItems",
            "mcpSettingsItem",
            "@/features/mcp/settings",
            "mcp",
            (binding) => binding
          ),
        ])
      : [];
  if (uploads && options.addUi) {
    const file = path.join(cwd, "composer-controls.ts");
    const previous = ui.find((edit) => edit.file === file);
    const edit = await planContribution(
      file,
      "composerControls",
      "attachmentUploadIntegration",
      "@/features/attachment-uploads/integration",
      "attachment-uploads",
      (binding) => `...${binding}.controls`,
      previous?.content
    );
    if (previous) {
      previous.content = edit.content;
    } else {
      ui.push(edit);
    }
  }
  await mkdir(path.join(cwd, "features"), { recursive: true });
  await Promise.all([
    writeFile(
      path.join(cwd, "features/installed-routers.ts"),
      `// Generated by chat-js sync.\nimport type { InstalledRouters } from "@/lib/installation-contracts";\n${mcp ? 'import { mcpRouter } from "@/trpc/routers/mcp.router";\n\n' : "\n"}export const installedRouters = {${mcp ? " mcp: mcpRouter " : ""}} satisfies InstalledRouters;\n`
    ),
    writeFile(
      path.join(cwd, "features/installed.ts"),
      `// Generated by chat-js sync.\nexport const installedFeatures: ReadonlySet<string> = new Set(${mcp || uploads ? JSON.stringify([...(mcp ? ["mcp"] : []), ...(uploads ? ["attachment-uploads"] : [])]) : ""});\n`
    ),
    writeFile(
      path.join(cwd, "features/installed-uploads.ts"),
      uploads
        ? '// Generated by chat-js sync.\nexport { attachmentUploadIntegration as attachmentUploads } from "@/features/attachment-uploads/integration";\n'
        : '// Generated by chat-js sync.\nimport type { AttachmentUploadIntegration } from "@/lib/installation-contracts";\n\nexport const attachmentUploads: AttachmentUploadIntegration = { controls: [], useUploads: (state) => ({ ...state, upload: () => Promise.resolve(), uploadQueue: [] }) };\n'
    ),
    ...ui.map(({ file, content }) => writeFile(file, content)),
  ]);
};

// Only fresh scaffolds use defaults. Cloning and sync never call this function.
export const initializeFeatureUi = async (cwd: string) => {
  for (const [file, name, marker, symbol] of [
    [
      "composer-controls.ts",
      "composerControls",
      "@/features/mcp/composer",
      "ConnectorsControl",
    ],
    [
      "composer-controls.ts",
      "composerControls",
      "@/features/attachment-uploads/controls",
      "AttachFilesControl",
    ],
    [
      "composer-controls.ts",
      "composerControls",
      "@/features/attachment-uploads/controls",
      "TakePhotoControl",
    ],
    [
      "composer-controls.ts",
      "composerControls",
      "@/features/attachment-uploads/integration",
      "attachmentUploadIntegration",
    ],
    [
      "settings-items.ts",
      "settingsItems",
      "@/features/mcp/settings",
      "mcpSettingsItem",
    ],
  ] as const) {
    const location = path.join(cwd, file);
    // oxlint-disable-next-line eslint/no-await-in-loop -- Only new scaffolds initialize these app-owned files.
    const source = await readFile(location, "utf-8");
    const parsed = ts.createSourceFile(
      file,
      source,
      ts.ScriptTarget.Latest,
      true
    );
    const edits: { start: number; end: number; text: string }[] = [];
    for (const node of parsed.statements) {
      if (
        ts.isImportDeclaration(node) &&
        ts.isStringLiteral(node.moduleSpecifier) &&
        node.moduleSpecifier.text === marker
      ) {
        edits.push({ end: node.end, start: node.getFullStart(), text: "" });
      }
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
        const entries = array.elements.filter((entry) => {
          if (
            ts.isSpreadElement(entry) &&
            entry.expression.getText(parsed) === `${symbol}.controls`
          ) {
            return false;
          }
          if (ts.isIdentifier(entry)) {
            return entry.text !== symbol;
          }
          return (
            !ts.isObjectLiteralExpression(entry) ||
            !entry.properties.some(
              (prop) =>
                ts.isPropertyAssignment(prop) &&
                ts.isIdentifier(prop.initializer) &&
                prop.initializer.text === symbol
            )
          );
        });
        edits.push({
          end: array.end,
          start: array.getStart(parsed),
          text: `[\n${entries.map((entry) => `${entry.getText(parsed)},`).join("\n")}\n]`,
        });
      }
    }
    let content = source;
    for (const edit of edits.toSorted((a, b) => b.start - a.start)) {
      content =
        content.slice(0, edit.start) + edit.text + content.slice(edit.end);
    }
    // oxlint-disable-next-line eslint/no-await-in-loop -- See above.
    await writeFile(location, content);
  }
  await syncFeatures(cwd);
};
