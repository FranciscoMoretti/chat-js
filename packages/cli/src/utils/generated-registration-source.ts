// These directives are emitted only into CLI-owned registration modules.
// Oxfmt owns generated import ordering; only retained restrictions need exceptions.
const registrationRules = (
  line: string,
  hasMultipleExports: boolean
): string[] => {
  const rules: string[] = [];
  if (hasMultipleExports) {
    rules.push("import/group-exports");
  }
  if (line.includes("undefined")) {
    rules.push("no-undefined");
  }
  if (line.startsWith("export type WorkflowTools = {")) {
    rules.push("typescript/consistent-type-definitions");
  }
  return rules;
};

const generatedRegistrationSource = (source: string): string => {
  const defaultDependencyLimit = 10;
  const importCount = source
    .split("\n")
    .filter((line) => line.startsWith("import ")).length;
  const singleExport = 1;
  const noRules = 0;
  const hasMultipleExports =
    source.split("\n").filter((line) => line.startsWith("export ")).length >
    singleExport;
  const rendered = source
    .split("\n")
    .map((line): string => {
      if (line.trim() === "undefined;") {
        return `// oxlint-disable-next-line no-undefined -- No installed provider implements this optional capability.\n${line}`;
      }
      if (!line.startsWith("export ")) {
        return line;
      }
      const rules = registrationRules(line, hasMultipleExports);
      if (rules.length === noRules) {
        return line;
      }
      return `// oxlint-disable-next-line ${rules.join(", ")} -- Generated registrations expose separate named contracts and optional capabilities selected by the installer.\n${line}`;
    })
    .join("\n");
  if (importCount > defaultDependencyLimit) {
    return `/* oxlint-disable import/max-dependencies -- This generated registry enumerates every installed tool; its dependencies grow with the user-selected installation. */\n${rendered}\n/* oxlint-enable import/max-dependencies */\n`;
  }
  return rendered;
};
export { generatedRegistrationSource };
