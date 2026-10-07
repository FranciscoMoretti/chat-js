/* oxlint-disable import/no-named-export -- Keep the named type bindings (RegistryIndexItem); the enabled import/no-default-export convention rejects the default-export alternative. */
export interface RegistryIndexItem {
  name: string;
  description?: string;
  hidden?: boolean;
  meta?: { chatjs?: { documentRunExport?: string; slot?: string } };
}
/* oxlint-enable import/no-named-export */
