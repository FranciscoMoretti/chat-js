"use client";
import { Plug } from "lucide-react";
import { SettingsLink } from "@/components/settings/settings-navigation-link";

export const ConnectorsSettingsLink = () => (
  <SettingsLink href="/settings/connectors">
    <Plug className="size-4" />
    Connectors
  </SettingsLink>
);
