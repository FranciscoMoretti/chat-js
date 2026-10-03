/* oxlint-disable typescript/consistent-type-definitions -- Keep this structural alias closed to declaration merging and compatible with the existing generic/record API. */
export type RegistryIndexItem = {
  name: string;
  description?: string;
  hidden?: boolean;
  meta?: { chatjs?: { documentRunExport?: string; slot?: string } };
};
/* oxlint-enable typescript/consistent-type-definitions */
