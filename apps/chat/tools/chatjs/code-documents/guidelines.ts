/* oxlint-disable import/prefer-default-export -- Keep the named import contract used by registry consumers and package callers even when this module exposes one value. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
export const codeGuidelines = `
Guidelines for Python code:
- Each snippet should be complete and runnable on its own
- Prefer using print() statements to display outputs
- Include helpful comments explaining the code
- Keep snippets concise (generally under 15 lines)
- Avoid external dependencies - use Python standard library
- Handle potential errors gracefully
- Return meaningful output that demonstrates the code's functionality
- Don't use input() or other interactive functions
- Don't access files or network resources
- Don't use infinite loops

The title MUST include the file extension (e.g., "script.py", "App.tsx", "utils.js").
This extension determines syntax highlighting.`;
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/prefer-default-export */
