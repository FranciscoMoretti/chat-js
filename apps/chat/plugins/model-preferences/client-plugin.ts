import { Cpu } from "lucide-react";
import type { ChatClientPlugin } from "@/lib/plugin-contracts";
import { useModelPreferences } from "./use-model-preferences";

export const modelPreferencesClient = () =>
  ({
    id: "model-preferences",
    settingsItems: [
      { href: "/settings/models", icon: Cpu, id: "models", label: "Models" },
    ],
    useModelVisibility: useModelPreferences,
  }) satisfies ChatClientPlugin;
