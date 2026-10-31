import { createStorageAdapter as installed } from "@/lib/storage-provider";

export const createStorageAdapter = (
  ...options: Parameters<typeof installed>
) => installed(...options);
