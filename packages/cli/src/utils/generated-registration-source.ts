// These directives are emitted only into CLI-owned registration modules.
// Oxfmt owns generated import ordering; only retained restrictions need exceptions.
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

const noRules = 0;

const registrationLine = (line: string, rendered: string): string => {
  const rules = registrationRules(line);
  if (rules.length === noRules) {
    return rendered;
  }
  return `// oxlint-disable-next-line ${rules.join(", ")} -- Generated registrations expose separate named contracts and optional capabilities selected by the installer.\n${rendered}`;
};
const defaultDependencyLimit = 10;

const renderRegistration = (
  line: string,
  grouped: boolean
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
  const declaration =
    /^export (?<kind>const|type) (?<name>[A-Za-z_$][\w$]*)(?=\s|[:=])/u.exec(
      line
    )?.groups;
  if (grouped && !declaration) {
    throw new Error("Unsupported generated registration export.");
  }
  const source = registrationLine(
    line,
    grouped ? line.slice("export ".length) : line
  );
  return grouped && declaration
    ? {
        source,
        ...(declaration.kind === "type"
          ? { type: declaration.name }
          : { value: declaration.name }),
      }
    : { source };
};

const generatedRegistrationSource = (source: string): string => {
  const singleExport = 1;
  const lines = source.split("\n");
  // These templates emit identifier-named const/type declarations, not arbitrary
  // application source. Gateway/storage, sync-tools and sync-features pass
  // fixed templates with one identifier declaration per export line; payload
  // strings are JSON-escaped, never raw multiline template literals. Preserve
  // initializers and directives; single reexports stay untouched.
  const grouped =
    lines.filter((line) => line.startsWith("export ")).length > singleExport;
  const registrations = lines.map((line) => renderRegistration(line, grouped));
  const values = registrations.flatMap((item) =>
    typeof item.value === "string" ? [item.value] : []
  );
  const types = registrations.flatMap((item) =>
    typeof item.type === "string" ? [item.type] : []
  );
  const rendered = `${[
    registrations
      .map((item) => item.source)
      .join("\n")
      .trimEnd(),
    ...(values.length > noRules ? [`export { ${values.join(", ")} };`] : []),
    ...(types.length > noRules ? [`export type { ${types.join(", ")} };`] : []),
  ].join("\n")}\n`;
  if (
    lines.filter((line) => line.startsWith("import ")).length >
    defaultDependencyLimit
  ) {
    return `/* oxlint-disable import/max-dependencies -- This generated registry enumerates every installed tool; its dependencies grow with the user-selected installation. */\n${rendered}/* oxlint-enable import/max-dependencies */\n`;
  }
  return rendered;
};
export { generatedRegistrationSource };
