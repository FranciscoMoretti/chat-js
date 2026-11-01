"use client";

import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import { parseAsString, useQueryStates } from "nuqs";
import { readInstallationSelection } from "../create-model";
import type { CreateProvider } from "../create-model";
import type { InstallationSelection } from "../../../../packages/registry/installation";

type InstallationContextValue = Readonly<{
  gateways: readonly CreateProvider[];
  storageProviders: readonly CreateProvider[];
  installation: InstallationSelection | null;
  update: (selection: InstallationSelection) => void;
}>;
const InstallationContext = createContext<InstallationContextValue | null>(
  null
);

export const InstallationProvider = ({
  gateways,
  storageProviders,
  children,
}: Readonly<{
  gateways: readonly CreateProvider[];
  storageProviders: readonly CreateProvider[];
  children: ReactNode;
}>) => {
  const [params, setParams] = useQueryStates({
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
  const value = useMemo<InstallationContextValue>(
    () => ({
      gateways,
      storageProviders,
      installation,
      update: (selection) => {
        void setParams({
          gateway: selection.gateway ?? null,
          storage: selection.storage?.source ?? null,
          uploads: String(selection.plugins.includes("attachment-uploads")),
          "storage-config": Object.keys(selection.storage?.options ?? {}).length
            ? JSON.stringify(selection.storage?.options)
            : null,
        });
      },
    }),
    [gateways, storageProviders, installation, setParams]
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
