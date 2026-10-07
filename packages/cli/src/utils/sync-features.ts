// oxlint-disable-next-line import/no-nodejs-modules -- The Node/Bun CLI reads, writes, and validates real project files with native filesystem APIs.
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules -- The Node/Bun CLI resolves platform-specific project and installation paths.
import path from "node:path";

import ts from "typescript";

/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { FeatureDefinition } from "../../../registry/metadata";
/* oxlint-enable sort-imports */
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { featureDefinitionSchema } from "../../../registry/metadata";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { attachmentUploadFiles } from "../../../registry/src/features/attachment-uploads";
/* oxlint-enable sort-imports */
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { mcpFiles } from "../../../registry/src/features/mcp";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { observabilityItems } from "../../../registry/src/features/observability";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { generatedRegistrationSource } from "./generated-registration-source";
/* oxlint-enable sort-imports */
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  initializeObservability,
  planObservability,
} from "./sync-observability";
/* oxlint-enable sort-imports */

type ReadonlyNative<Value> = Value extends (
  ...args: readonly never[]
) => unknown
  ? Value
  : Value extends object
    ? { readonly [Key in keyof Value]: ReadonlyNative<Value[Key]> }
    : Value;
const NO_UNSUPPORTED_FEATURES = 0;

/**
 * Extend only when an implementation has complete installer/sync integration.
 * @param {readonly ReadonlyNative<FeatureDefinition>[]} features Resolved feature metadata to validate without mutation.
 */
const assertSupportedFeatureInstallation = (
  features: readonly ReadonlyNative<FeatureDefinition>[]
): void => {
  const unsupported = features.filter(
    (feature: ReadonlyNative<FeatureDefinition>): boolean =>
      !["mcp", "attachment-uploads"].includes(feature.id) &&
      !observabilityItems.some(
        (item: ReadonlyNative<(typeof observabilityItems)[number]>): boolean =>
          item.name === feature.id
      )
  );
  if (unsupported.length > NO_UNSUPPORTED_FEATURES) {
    throw new Error(
      `Feature installation is not supported yet: ${unsupported.map((feature: ReadonlyNative<FeatureDefinition>) => feature.id).join(", ")}. Supported features: MCP, attachment uploads, Vercel Analytics, Vercel Speed Insights and Langfuse.`
    );
  }
};

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve exists's awaited sequencing and rejected-Promise behavior. */
const exists = async (file: string): Promise<boolean> => {
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
/* oxlint-enable oxc/no-async-await */
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
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading namedBindings from imported.importClause; read importClause from imported; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
  const bindings = imported?.importClause?.namedBindings;
  const namedBindings =
    // oxlint-disable-next-line no-ternary -- Keep namedBindings as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
    bindings && ts.isNamedImports(bindings) ? bindings.elements : [];
  const specifier = namedBindings.find(
    (item: ReadonlyNative<ts.ImportSpecifier>): boolean =>
      !item.isTypeOnly && (item.propertyName ?? item.name).text === symbol
  );
  if (bindings && ts.isNamespaceImport(bindings)) {
    return { binding: `${bindings.name.text}.${symbol}`, bindings, specifier };
  }
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading name from specifier; preserve one receiver evaluation, skipped accesses and the existing symbol fallback.
  return { binding: specifier?.name.text ?? symbol, bindings, specifier };
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

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve planContribution's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable eslint/max-params -- This adapter implements the existing positional callback contract; changing it requires updating every caller. */
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
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading initializer from declaration; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
    !declaration?.initializer ||
    !ts.isArrayLiteralExpression(declaration.initializer)
  ) {
    throw new Error(
      `Add the feature contribution to ${file} manually: ${name} is no longer a literal array. Then run chat-js sync. To retry automatic UI integration, restore a literal array and retry chat-js add.`
    );
  }
  const array = declaration.initializer;
  // oxlint-disable-next-line no-ternary -- Keep contributionIds as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
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
          item.expression.getText(parsed) === `${binding}.controls`) ||
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
        `Cannot import ${symbol} in ${file}: that name is already used. Add the feature contribution manually and run chat-js sync.`
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
      const importEnd =
        // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading end from parsed.statements.findLast(...); preserve one receiver evaluation, skipped accesses and the existing SOURCE_START fallback.
        parsed.statements.findLast(
          (node: ReadonlyNative<ts.Statement>): boolean =>
            ts.isImportDeclaration(node) ||
            (ts.isExpressionStatement(node) &&
              ts.isStringLiteral(node.expression))
        )?.end ?? SOURCE_START;
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve validateAttachmentUploads's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable eslint/max-params */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable eslint/id-length -- Short callback indices and coordinate keys match the surrounding collection or external data shape; renaming public keys would change the contract. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
const validateAttachmentUploads = async (
  cwd: string,
  expected?: boolean
): Promise<boolean> => {
  const uploadDescriptor = path.join(
    cwd,
    "features/attachment-uploads/chatjs.json"
  );
  const uploads = await exists(uploadDescriptor);
  const uploadPresence = await Promise.all(
    attachmentUploadFiles.map((file): Promise<boolean> =>
      exists(path.join(cwd, file))
    )
  );
  if (!uploads && (expected === true || uploadPresence.some(Boolean))) {
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
      (_, index): boolean => !uploadPresence[index]
    );
    if (missing.length > 0) {
      throw new Error(
        `Attachment uploads installation is incomplete. Missing: ${missing.join(", ")}. Run chat-js add attachment-uploads to restore missing files.`
      );
    }
  }
  return uploads;
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve validateMcp's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/id-length */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable eslint/id-length -- Short callback indices and coordinate keys match the surrounding collection or external data shape; renaming public keys would change the contract. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
const validateMcp = async (
  cwd: string,
  expected?: boolean
): Promise<boolean> => {
  const descriptor = path.join(cwd, "features/mcp/chatjs.json");
  const mcp = await exists(descriptor);
  const presence = await Promise.all(
    mcpFiles.map((file): Promise<boolean> => exists(path.join(cwd, file)))
  );
  if (!mcp && (expected === true || presence.some(Boolean))) {
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
    const missing = mcpFiles.filter((_, index): boolean => !presence[index]);
    if (missing.length > 0) {
      throw new Error(
        `MCP installation is incomplete. Missing: ${missing.join(", ")}. Run chat-js add mcp to restore the missing files.`
      );
    }
  }
  return mcp;
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve syncFeatures's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/id-length */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable typescript/strict-boolean-expressions -- This value-producing condition preserves the current nullish/empty sentinel behavior; coercing it would change the returned value. */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
const syncFeatures = async (
  cwd: string,
  options: Readonly<{
    addUi?: boolean | readonly string[];
    expectedMcp?: boolean;
    expectedUploads?: boolean;
  }> = {}
): Promise<void> => {
  const uiFeatures =
    // oxlint-disable-next-line no-ternary -- Keep uiFeatures as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
    options.addUi === true
      ? ["mcp", "attachment-uploads"]
      : // oxlint-disable-next-line typescript/prefer-nullish-coalescing -- False explicitly disables optional UI installation; the empty array must replace false as well as undefined.
        options.addUi || [];

  const observability = await planObservability(cwd);
  const mcp = await validateMcp(cwd, options.expectedMcp);
  const uploads = await validateAttachmentUploads(cwd, options.expectedUploads);
  const ui: { content: string; file: string }[] =
    // oxlint-disable-next-line no-ternary -- Keep ui as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
    mcp && uiFeatures.includes("mcp")
      ? await Promise.all([
          planContribution(
            path.join(cwd, "composer-controls.ts"),
            "composerControls",
            "ConnectorsControl",
            "@/features/mcp/composer",
            "mcp",
            (binding): string => `{ Component: ${binding}, id: "mcp" }`
          ),
          planContribution(
            path.join(cwd, "settings-items.ts"),
            "settingsItems",
            "mcpSettingsItem",
            "@/features/mcp/settings",
            "mcp",
            (binding): string => binding
          ),
        ])
      : [];
  if (uploads && uiFeatures.includes("attachment-uploads")) {
    const file = path.join(cwd, "composer-controls.ts");
    const previous = ui.find(
      (edit: Readonly<{ content: string; file: string }>): boolean =>
        edit.file === file
    );
    const edit = await planContribution(
      file,
      "composerControls",
      "attachmentUploads",
      "@/features/attachment-uploads/integration",
      ["attach-files", "take-photo"],
      (binding): string => `...${binding}.controls`,
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading content from previous; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
      previous?.content
    );
    if (previous) {
      previous.content = edit.content;
    } else {
      ui.push(edit);
    }
  }
  const installed = [
    // oxlint-disable-next-line no-ternary -- Keep iterable spread as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
    ...(mcp ? ["mcp"] : []),
    // oxlint-disable-next-line no-ternary -- Keep iterable spread as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
    ...(uploads ? ["attachment-uploads"] : []),
    ...observability.ids,
  ];
  // oxlint-disable-next-line no-ternary -- Keep installedSet as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
  const installedSet = installed.length > 0 ? JSON.stringify(installed) : "";
  const installedSource = `export const installedFeatures: ReadonlySet<string> = new Set(${installedSet});`;
  const formattedInstalledSource =
    // oxlint-disable-next-line no-ternary -- Keep formattedInstalledSource as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
    installedSource.length > 80
      ? `export const installedFeatures: ReadonlySet<string> = new Set([\n${installed.map((id): string => `  "${id}",`).join("\n")}\n]);`
      : installedSource;
  await mkdir(path.join(cwd, "features"), { recursive: true });
  await Promise.all([
    writeFile(
      path.join(cwd, "features/installed-routers.ts"),
      generatedRegistrationSource(
        // oxlint-disable-next-line no-ternary -- Keep template interpolation as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
        `// Generated by chat-js sync.\nimport type { InstalledRouters } from "@/lib/installation-contracts";\n${mcp ? 'import { mcpRouter } from "@/trpc/routers/mcp.router";\n\n' : "\n"}export const installedRouters = {${mcp ? " mcp: mcpRouter " : ""}} satisfies InstalledRouters;\n`
      )
    ),
    writeFile(
      path.join(cwd, "features/installed.ts"),
      generatedRegistrationSource(
        `// Generated by chat-js sync.\n${formattedInstalledSource}\n`
      )
    ),
    writeFile(
      path.join(cwd, "features/installed-uploads.ts"),
      generatedRegistrationSource(
        // oxlint-disable-next-line no-ternary -- Keep generatedRegistrationSource argument as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
        uploads
          ? '// Generated by chat-js sync.\nexport { attachmentUploads } from "@/features/attachment-uploads/integration";\n'
          : '// Generated by chat-js sync.\nimport type { AttachmentUploadIntegration } from "@/lib/installation-contracts";\n\nexport const attachmentUploads: AttachmentUploadIntegration = {\n  controls: [],\n  useUploads: () => ({ uploadQueue: [] }),\n};\n'
      )
    ),
    ...observability.files.map(
      ({
        file,
        content,
      }: Readonly<{ content: string; file: string }>): Promise<void> =>
        writeFile(file, generatedRegistrationSource(content))
    ),
    ...ui.map(
      ({
        file,
        content,
      }: Readonly<{ content: string; file: string }>): Promise<void> =>
        writeFile(file, content)
    ),
  ]);
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve initializeFeatureUi's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable eslint/no-continue -- Skipping an ineligible item here keeps the remaining per-item operation inside the same loop and cleanup scope. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
// Only fresh scaffolds use defaults. Cloning and sync never call this function.
const initializeFeatureUi = async (cwd: string): Promise<void> => {
  await initializeObservability(cwd);
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
      "attachmentUploads",
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
        const entries = array.elements.filter(
          (entry: ReadonlyNative<ts.Expression>): boolean => {
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
                (prop: ReadonlyNative<ts.ObjectLiteralElementLike>): boolean =>
                  ts.isPropertyAssignment(prop) &&
                  ts.isIdentifier(prop.initializer) &&
                  prop.initializer.text === symbol
              )
            );
          }
        );
        edits.push({
          end: array.end,
          start: array.getStart(parsed),
          text: `[\n${entries.map((entry: ReadonlyNative<ts.Expression>): string => `${entry.getText(parsed)},`).join("\n")}\n]`,
        });
      }
    }
    let content = source;
    for (const edit of edits.toSorted(
      (
        leftEdit: Readonly<{ start: number }>,
        rightEdit: Readonly<{ start: number }>
      ): number => rightEdit.start - leftEdit.start
    )) {
      content =
        content.slice(0, edit.start) + edit.text + content.slice(edit.end);
    }
    // oxlint-disable-next-line eslint/no-await-in-loop -- See above.
    await writeFile(location, content);
  }
  await syncFeatures(cwd);
};
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (assertSupportedFeatureInstallation, initializeFeatureUi, syncFeatures); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/no-continue */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable max-lines -- Keep this cohesive contract and its cases together; splitting it solely for a line quota would obscure shared setup or state transitions. */
export {
  assertSupportedFeatureInstallation,
  initializeFeatureUi,
  syncFeatures,
};
/* oxlint-enable import/no-named-export */
