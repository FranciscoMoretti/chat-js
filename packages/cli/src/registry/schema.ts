/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable typescript/consistent-type-definitions -- Keep this structural alias closed to declaration merging and compatible with the existing generic/record API. */
export type RegistryIndexItem = {
  name: string;
  description?: string;
  hidden?: boolean;
  meta?: { chatjs?: { documentRunExport?: string; slot?: string } };
};
/* oxlint-enable typescript/consistent-type-definitions */
/* oxlint-enable import/no-named-export */
