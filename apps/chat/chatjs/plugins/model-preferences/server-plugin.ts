import type { ChatPlugin } from "@/chatjs/core/installation/plugin";
import { modelPreferencesRouter } from "./router";

export default function modelPreferences() {
  return {
    id: "model-preferences",
    routers: { modelPreferences: modelPreferencesRouter },
  } satisfies ChatPlugin;
}
