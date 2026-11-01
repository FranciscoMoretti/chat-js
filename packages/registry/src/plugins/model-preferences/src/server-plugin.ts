import type { ChatPlugin } from "@/chatjs/core/installation/plugin";
import { modelPreferencesRouter } from "./router";

export const modelPreferences = () =>
  ({
    id: "model-preferences",
    routers: { modelPreferences: modelPreferencesRouter },
  }) satisfies ChatPlugin;
