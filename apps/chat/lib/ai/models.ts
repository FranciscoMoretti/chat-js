import { unstable_cache } from "next/cache";
import { config } from "@/lib/config";
import { discoverModels } from "./model-catalog";

export const fetchModels = unstable_cache(
  discoverModels,
  [`ai-gateway-models-${config.ai.gateway}`],
  { revalidate: 3600, tags: ["ai-gateway-models"] }
);
