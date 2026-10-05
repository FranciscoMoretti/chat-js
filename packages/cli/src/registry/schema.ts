export interface RegistryIndexItem {
  name: string;
  description?: string;
  hidden?: boolean;
  meta?: { chatjs?: { documentRunExport?: string; slot?: string } };
}
