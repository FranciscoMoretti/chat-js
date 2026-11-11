"use client";

import { createContext, useContext, useMemo, useEffect } from "react";
import type { ReactNode } from "react";
import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";
import {
  readInstallationSelection,
  encodeInstallationQuery,
} from "../create-model";
import type { CreateProvider } from "../create-model";
import { resolveInstallationSelection } from "../../../../packages/registry/installation-catalog";
import type { InstallationCatalogItem } from "../../../../packages/registry/installation-catalog";
import type { InstallationSelection } from "../../../../packages/registry/installation";

type InstallationContextValue = Readonly<{
  catalog: readonly InstallationCatalogItem[];
  resolution: ReturnType<typeof resolveInstallationSelection> | null;
  gateways: readonly CreateProvider[];
  storageProviders: readonly CreateProvider[];
  installation: InstallationSelection | null;
  scenario: "ready" | "mutation-error";
  update: (selection: InstallationSelection) => void;
}>;
const InstallationContext = createContext<InstallationContextValue | null>(
  null
);

export const InstallationProvider = ({
  catalog,
  children,
}: Readonly<{
  catalog: readonly InstallationCatalogItem[];
  children: ReactNode;
}>) => {
  const { gateways, storageProviders } = useMemo(
    () => ({
      gateways: catalog.flatMap((item) =>
        item.definition?.kind === "gateway"
          ? [{ id: item.definition.id, title: item.title }]
          : []
      ),
      storageProviders: catalog.flatMap((item) =>
        item.definition?.kind === "storage"
          ? [
              {
                id: item.definition.id,
                title: item.title,
                configKeys: item.definition.configKeys,
              },
            ]
          : []
      ),
    }),
    [catalog]
  );
  const [params, setParams] = useQueryStates({
    app: parseAsString,
    installation: parseAsString,
    // Test-only fault injection; never included in shared or installation URLs.
    __previewScenario: parseAsStringLiteral([
      "ready",
      "mutation-error",
    ]).withDefault("ready"),
    gateway: parseAsString,
    storage: parseAsString,
    uploads: parseAsString,
    "storage-config": parseAsString,
  });
  const installation = useMemo(() => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== null) {
        query.set(key, value);
      }
    }
    return readInstallationSelection(query, gateways, storageProviders);
  }, [params, gateways, storageProviders]);
  const resolution = useMemo(
    () =>
      installation ? resolveInstallationSelection(installation, catalog) : null,
    [installation, catalog]
  );
  // Replace legacy JSON links without adding history entries or resolving implicit
  // dependencies into explicit selections. The URL records only user choices.
  useEffect(() => {
    if (!installation) {
      return;
    }
    const canonical = encodeInstallationQuery(installation);
    if (
      (
        [
          "app",
          "installation",
          "storage-config",
          "gateway",
          "storage",
          "uploads",
        ] as const
      ).some((key) => params[key] !== canonical[key])
    ) {
      void setParams(canonical, { history: "replace" });
    }
  }, [installation, params, setParams]);
  const value = useMemo<InstallationContextValue>(
    () => ({
      catalog,
      resolution,
      gateways,
      storageProviders,
      installation,
      scenario: params.__previewScenario,
      update: (selection) => {
        void setParams(encodeInstallationQuery(selection));
      },
    }),
    [
      catalog,
      resolution,
      gateways,
      storageProviders,
      installation,
      params.__previewScenario,
      setParams,
    ]
  );
  return <InstallationContext value={value}>{children}</InstallationContext>;
};

export const useInstallation = (): InstallationContextValue => {
  const value = useContext(InstallationContext);
  if (!value) {
    throw new Error("Create requires InstallationProvider.");
  }
  return value;
};
