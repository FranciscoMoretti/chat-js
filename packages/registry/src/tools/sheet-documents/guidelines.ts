/* oxlint-disable import/prefer-default-export -- Keep the named import contract used by registry consumers and package callers even when this module exposes one value. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
export const sheetGuidelines = `
IMPORTANT CSV FORMATTING RULES:
- NEVER use commas (,) within cell contents as they will break the CSV format
- For numbers over 999, do not use any thousand separators (write as: 10000 not 10,000)
- Use semicolons (;) or spaces to separate multiple items in a cell`;
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/prefer-default-export */
