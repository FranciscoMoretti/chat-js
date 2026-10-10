// These directives are emitted only into CLI-owned registration modules.
// The registration generator preserves its declared import order.
const registrationRules = (line: string): string[] => {
  const rules: string[] = [];
  if (/[=]\s*undefined;\s*$/u.test(line)) {
    rules.push("no-undefined");
  }
  if (line.startsWith("export type WorkflowTools = {")) {
    rules.push("typescript/consistent-type-definitions");
  }
  return rules;
};

const singleExport = 1;

const registrationExportRules = (
  line: string,
  preferDefault: boolean
): string[] => {
  if (
    !line.startsWith("export ") ||
    line.startsWith("export default ") ||
    /^export \{[^},]+ as default\s*\}/u.test(line)
  ) {
    return [];
  }
  const rules = ["import/no-named-export"];
  if (preferDefault) {
    rules.push("import/prefer-default-export");
  }
  return rules;
};

const singleValueRegistration = (line: string): boolean => {
  if (
    /^export const [A-Za-z_$][\w$]*\s*[:=]/u.test(line) ||
    /^export \* as [A-Za-z_$][\w$]* /u.test(line)
  ) {
    return true;
  }
  const match = /^export \{(?<bindings>[^}]*)\}/u.exec(line);
  if (!match) {
    return false;
  }
  const reexport = match.groups;
  if (!reexport) {
    return false;
  }
  const bindings = reexport.bindings
    .split(",")
    .map((binding) => binding.trim())
    .filter((binding) => binding !== "");
  return (
    bindings.length === singleExport &&
    bindings.every(
      (binding) =>
        !binding.startsWith("type ") && !binding.endsWith(" as default")
    )
  );
};

const noRules = 0;

const registrationLine = (
  line: string,
  rendered: string,
  preferDefault = false
): string => {
  const rules = registrationRules(line);
  rules.push(...registrationExportRules(rendered, preferDefault));
  if (rules.length === noRules) {
    return rendered;
  }
  return `// oxlint-disable-next-line ${rules.join(", ")} -- Generated registrations expose separate named contracts and optional capabilities selected by the installer.\n${rendered}`;
};
const defaultDependencyLimit = 10;

const registrationDeclaration = (
  line: string,
  grouped: boolean
): Record<string, string> | undefined => {
  const declaration =
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading groups from /^export (?<kind>const|type) (?<name>[A-Za-z_$][\w$]*)(?=\s|[:=])/u.exec(...); preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
    /^export (?<kind>const|type) (?<name>[A-Za-z_$][\w$]*)(?=\s|[:=])/u.exec(
      line
    )?.groups;
  if (grouped && !declaration) {
    throw new Error("Unsupported generated registration export.");
  }
  return declaration;
};

const renderRegistration = (
  line: string,
  grouped: boolean,
  preferDefault: boolean
): {
  readonly source: string;
  readonly value?: string;
  readonly type?: string;
} => {
  if (line.trim() === "undefined;") {
    return {
      source: `// oxlint-disable-next-line no-undefined -- No installed provider implements this optional capability.\n${line}`,
    };
  }
  if (!line.startsWith("export ")) {
    return { source: line };
  }
  const declaration = registrationDeclaration(line, grouped);
  const source = registrationLine(
    line,
    // oxlint-disable-next-line no-ternary -- Keep registrationLine argument as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
    grouped ? line.slice("export ".length) : line,
    preferDefault
  );
  if (grouped && declaration) {
    return {
      source,
      // oxlint-disable-next-line no-ternary -- Keep the selected generated property name as a value expression; assigning either key through if/else conflicts with pinned unicorn/prefer-ternary.
      [declaration.kind === "type" ? "type" : "value"]: declaration.name,
    };
  }
  return { source };
};

const registrationExportPlan = (
  lines: readonly string[]
): { grouped: boolean; preferDefault: boolean } => {
  const exports = lines.filter((line) => line.startsWith("export "));
  return {
    grouped: exports.length > singleExport,
    preferDefault:
      exports.length === singleExport &&
      exports.some((line) => singleValueRegistration(line)),
  };
};

const registrationExports = (
  values: readonly string[],
  types: readonly string[]
): string[] => {
  const clauses: string[] = [];
  if (values.length > noRules) {
    const clause = `export { ${values.join(", ")} };`;
    clauses.push(
      registrationLine(
        "",
        clause,
        values.length === singleExport && types.length === noRules
      )
    );
  }
  if (types.length > noRules) {
    const clause = `export type { ${types.join(", ")} };`;
    clauses.push(registrationLine("", clause, false));
  }
  return clauses;
};

const generatedRegistrationSource = (source: string): string => {
  const lines = source.split("\n");
  // These templates emit identifier-named const/type declarations, not arbitrary
  // application source. Gateway/storage, sync-tools and sync-features pass
  // fixed templates with one identifier declaration per export line; payload
  // strings are JSON-escaped, never raw multiline template literals. Preserve
  // initializers and directives; single reexports stay untouched.
  const { grouped, preferDefault } = registrationExportPlan(lines);
  const registrations = lines.map((line) =>
    renderRegistration(line, grouped, preferDefault)
  );
  const values = registrations.flatMap((item) => {
    if (typeof item.value === "string") {
      return [item.value];
    }
    return [];
  });
  const types = registrations.flatMap((item) => {
    if (typeof item.type === "string") {
      return [item.type];
    }
    return [];
  });
  const rendered = `${[
    registrations
      .map((item) => item.source)
      .join("\n")
      .trimEnd(),
    ...registrationExports(values, types),
  ].join("\n")}\n`;
  if (
    lines.filter((line) => line.startsWith("import ")).length >
    defaultDependencyLimit
  ) {
    return `/* oxlint-disable import/max-dependencies -- This generated registry enumerates every installed tool; its dependencies grow with the user-selected installation. */\n${rendered}/* oxlint-enable import/max-dependencies */\n`;
  }
  return rendered;
};
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (generatedRegistrationSource); the enabled import/no-default-export convention rejects the default-export alternative. */
export { generatedRegistrationSource };
/* oxlint-enable import/prefer-default-export, import/no-named-export */
