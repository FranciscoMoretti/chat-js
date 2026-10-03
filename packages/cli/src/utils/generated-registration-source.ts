// These directives are emitted only into CLI-owned registration modules.
// The application imports their named bindings, and deterministic generated
// import order follows registration order rather than identifier spelling.
const registrationRules = (line: string): string[] => {
  const rules = [
    "import/no-named-export",
    "import/prefer-default-export",
    "import/group-exports",
  ];
  if (line.includes("...")) {
    rules.push("oxc/no-rest-spread-properties");
  }
  if (line.includes("undefined")) {
    rules.push("no-undefined");
  }
  if (line.startsWith("export type WorkflowTools = {")) {
    rules.push("typescript/consistent-type-definitions");
  }
  return rules;
};

/* oxlint-disable import/no-named-export, import/prefer-default-export -- Generator callers share this named source transformation. */
export const generatedRegistrationSource = (source: string): string => {
  const defaultDependencyLimit = 10;
  const importCount = source
    .split("\n")
    .filter((line) => line.startsWith("import ")).length;
  const rendered = source
    .split("\n")
    .map((line): string => {
      if (line.startsWith("import ")) {
        return `// oxlint-disable-next-line sort-imports -- Generated imports enumerate every installed registration in deterministic order.\n${line}`;
      }
      if (line.trim() === "undefined;") {
        return `// oxlint-disable-next-line no-undefined -- No installed provider implements this optional capability.\n${line}`;
      }
      if (!line.startsWith("export ")) {
        return line;
      }
      return `// oxlint-disable-next-line ${registrationRules(line).join(", ")} -- Generated named registrations preserve the app import contract, optional capabilities, and immutable custom overrides.\n${line}`;
    })
    .join("\n");
  if (importCount > defaultDependencyLimit) {
    return `/* oxlint-disable import/max-dependencies -- This generated registry enumerates every installed tool; its dependencies grow with the user-selected installation. */\n${rendered}\n/* oxlint-enable import/max-dependencies */\n`;
  }
  return rendered;
};
/* oxlint-enable import/no-named-export, import/prefer-default-export */
