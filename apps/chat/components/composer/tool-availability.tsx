"use client";
import { createContext, useContext } from "react";
import { installedToolNames } from "@/integrations/tools/catalog";

/** Runtime selection; the normal app uses its generated installed catalog. */
export const ToolAvailabilityContext =
  createContext<ReadonlySet<string>>(installedToolNames);
export const useAvailableTools = () => useContext(ToolAvailabilityContext);
