import { installedModelVisibility } from "@/chatjs/generated/installed-model-visibility";
import type { ModelVisibility } from "@/lib/installation-contracts";
import { selectIntegration } from "@/lib/select-integration";

// Select the hook at module scope: never iterate over hooks during a render.
export const useModelVisibility: ModelVisibility =
  selectIntegration("model visibility", installedModelVisibility) ??
  ((defaultEnabledIds) => defaultEnabledIds);
