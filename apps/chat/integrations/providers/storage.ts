import { createStorageAdapter as installed } from "@/chatjs/providers/storage";

export const createStorageAdapter = (
  ...options: Parameters<typeof installed>
) => installed(...options);
