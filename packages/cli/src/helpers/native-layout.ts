import ts from "typescript";

// Native font replacement can leave the previous next/font import behind.
// Remove unused imports without changing native font declarations or JSX.
export const cleanNativeLayoutImports = (source: string): string => {
  const fileName = "layout.tsx";
  const service = ts.createLanguageService({
    fileExists: (file) => file === fileName,
    getCompilationSettings: () => ({
      jsx: ts.JsxEmit.Preserve,
      noLib: true,
      noResolve: true,
    }),
    getCurrentDirectory: () => "",
    getDefaultLibFileName: () => "lib.d.ts",
    getScriptFileNames: () => [fileName],
    getScriptSnapshot: (file) =>
      file === fileName ? ts.ScriptSnapshot.fromString(source) : undefined,
    getScriptVersion: () => "0",
    readFile: (file) => (file === fileName ? source : undefined),
  });
  try {
    const changes = service.organizeImports(
      { fileName, mode: ts.OrganizeImportsMode.RemoveUnused, type: "file" },
      {},
      {}
    );
    let result = source;
    for (const change of changes
      .flatMap((file) => file.textChanges)
      .toReversed()) {
      result =
        result.slice(0, change.span.start) +
        change.newText +
        result.slice(change.span.start + change.span.length);
    }
    return result;
  } finally {
    service.dispose();
  }
};
