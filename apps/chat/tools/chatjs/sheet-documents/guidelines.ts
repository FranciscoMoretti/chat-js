/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (sheetGuidelines); the enabled import/no-default-export convention rejects the default-export alternative. */
export const sheetGuidelines = `
IMPORTANT CSV FORMATTING RULES:
- NEVER use commas (,) within cell contents as they will break the CSV format
- For numbers over 999, do not use any thousand separators (write as: 10000 not 10,000)
- Use semicolons (;) or spaces to separate multiple items in a cell`;
/* oxlint-enable import/prefer-default-export, import/no-named-export */
