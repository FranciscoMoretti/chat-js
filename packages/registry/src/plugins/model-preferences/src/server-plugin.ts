import type { ChatPlugin } from "@/lib/plugin-contracts";
import { modelPreferencesRouter } from "./router";

export const modelPreferences = () =>
  ({
    id: "model-preferences",
    routers: { modelPreferences: modelPreferencesRouter },
  }) satisfies ChatPlugin;
