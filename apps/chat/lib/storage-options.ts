import type { EnvRequirement } from "./config-requirements";
import type { createStorageAdapter } from "./storage-provider";

const storageOptions = {
  bucket: "chatjs-staging",
  public: false,
} satisfies Parameters<typeof createStorageAdapter>[0];
const storageId = "supabase";
const storageEnvRequirements: EnvRequirement[] = [
  {
    description: "Supabase private storage",
    options: [["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]],
  },
];
export { storageOptions, storageId, storageEnvRequirements };
