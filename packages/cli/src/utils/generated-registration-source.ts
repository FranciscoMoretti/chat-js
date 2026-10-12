const singleExport = 1;
const noExports = 0;

const registrationDeclaration = (
  line: string,
  grouped: boolean
): Record<string, string> | undefined => {
  const declaration =
    /^export (?<kind>const|type|interface) (?<name>[A-Za-z_$][\w$]*)(?=\s|[:=])/u.exec(
      line
    )?.groups;
  if (grouped && !declaration) {
    throw new Error("Unsupported generated registration export.");
  }
  return declaration;
};

const renderRegistration = (
  line: string,
  grouped: boolean
): {
  readonly source: string;
  readonly value?: string;
  readonly type?: string;
} => {
  if (!line.startsWith("export ")) {
    return { source: line };
  }
  const declaration = registrationDeclaration(line, grouped);
  const rendered = grouped ? line.slice("export ".length) : line;
  const source = rendered;
  if (grouped && declaration) {
    return {
      source,
      [declaration.kind === "const" ? "value" : "type"]: declaration.name,
    };
  }
  return { source };
};

const registrationExports = (
  values: readonly string[],
  types: readonly string[]
): string[] => {
  const clauses: string[] = [];
  if (values.length > noExports) {
    clauses.push(`export { ${values.join(", ")} };`);
  }
  if (types.length > noExports) {
    clauses.push(`export type { ${types.join(", ")} };`);
  }
  return clauses;
};

const generatedRegistrationSource = (source: string): string => {
  const lines = source.split("\n");
  // Templates contain one identifier declaration per export line. Preserve
  // initializer order and the existing grouped value/type export layout.
  const grouped =
    lines.filter((line) => line.startsWith("export ")).length > singleExport;
  const registrations = lines.map((line) => renderRegistration(line, grouped));
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
  return `${[
    registrations
      .map((item) => item.source)
      .join("\n")
      .trimEnd(),
    ...registrationExports(values, types),
  ].join("\n")}\n`;
};

export { generatedRegistrationSource };
