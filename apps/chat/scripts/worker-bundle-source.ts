// Compiler diagnostics survive identifier renaming and whitespace minification.
// Keep these runtime message keys tied to the installed TypeScript version.
const compilerDiagnostics = [
  "Cannot_find_name_0_2304",
  "Type_0_is_not_assignable_to_type_1_2322",
];

/**
 * Detect the compiler's diagnostic table in emitted JavaScript.
 * @param {string} source Emitted worker chunk, including minified output.
 * @returns {boolean} Whether compiler diagnostic data remains bundled.
 */
export const hasBundledTypeScriptCompiler = (source: string): boolean =>
  compilerDiagnostics.every((diagnostic) => source.includes(diagnostic));
