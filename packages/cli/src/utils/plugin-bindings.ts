import ts from "typescript";

const isLocalBinding = (name: string): boolean =>
  name !== "arguments" &&
  name !== "eval" &&
  ts
    .createScanner(
      ts.ScriptTarget.Latest,
      false,
      ts.LanguageVariant.Standard,
      name
    )
    .scan() === ts.SyntaxKind.Identifier;

/** Allocate names per generated file and preserve unique, usable export names. */
export const pluginBindings = <
  Entry extends { readonly id: string; readonly preferred: string },
>(
  entries: readonly Entry[],
  reserved: readonly string[]
) => {
  const counts = new Map<string, number>();
  for (const { preferred } of entries) {
    counts.set(preferred, (counts.get(preferred) ?? 0) + 1);
  }
  const blocked = new Set(reserved);
  const usePreferred = (name: string): boolean =>
    counts.get(name) === 1 && !blocked.has(name) && isLocalBinding(name);
  const used = new Set([
    ...reserved,
    ...entries.map(({ preferred }) => preferred).filter(usePreferred),
  ]);

  return entries.map((entry) => {
    const { id, preferred } = entry;
    if (usePreferred(preferred)) {
      return { ...entry, name: preferred };
    }
    let alias = `${preferred}_${id.replaceAll("-", "_")}`;
    while (used.has(alias)) {
      alias += "_";
    }
    used.add(alias);
    return { ...entry, name: alias };
  });
};
