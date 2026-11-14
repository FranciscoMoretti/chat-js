"use client";

import { useState } from "react";
import {
  eveItemIdSchema,
  eveRegistriesSchema,
} from "../../../../packages/registry/eve-catalog";
import { Button } from "@/vendor/shadcn-create/styles/base-nova/ui/button";
import { Input } from "@/vendor/shadcn-create/styles/base-nova/ui/input";
import { useInstallation } from "./installation-provider";

export const RegistryCapabilityForm = () => {
  const { installation, update } = useInstallation();
  const [address, setAddress] = useState("");
  const [template, setTemplate] = useState("");
  const [error, setError] = useState<string>();
  const namespace = address.trim().startsWith("@")
    ? address.trim().split("/")[0]
    : undefined;
  const custom =
    namespace !== undefined && !["@skills", "@chatjs"].includes(namespace);
  return (
    <details className="bg-muted/20 rounded-xl border border-dashed p-5">
      <summary className="cursor-pointer text-sm font-medium">
        Add from another registry
      </summary>
      <form
        className="mt-4 max-w-xl space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!installation) {
            return;
          }
          const parsed = eveItemIdSchema.safeParse(address.trim());
          if (!parsed.success) {
            setError(parsed.error.issues[0].message);
            return;
          }
          const registries = eveRegistriesSchema.safeParse({
            ...installation.eveRegistries,
            ...(custom && namespace !== undefined && template.trim() !== ""
              ? { [namespace]: template.trim() }
              : {}),
          });
          if (!registries.success) {
            setError(registries.error.issues[0].message);
            return;
          }
          if (
            custom &&
            namespace !== undefined &&
            registries.data[namespace] === undefined
          ) {
            setError(`Enter the registry URL template for ${namespace}.`);
            return;
          }
          update({
            ...installation,
            eve: [...new Set([...(installation.eve ?? []), parsed.data])],
            eveRegistries: registries.data,
          });
          setAddress("");
          setTemplate("");
          setError(undefined);
        }}
      >
        <label htmlFor="registry-item" className="block space-y-1 text-sm">
          Registry item
          <Input
            id="registry-item"
            aria-label="Registry item"
            placeholder="@skills/owner/repository/skill or HTTPS item URL"
            value={address}
            onChange={(event) => {
              setAddress(event.target.value);
            }}
          />
        </label>
        {custom && (
          <label
            htmlFor="registry-template"
            className="block space-y-1 text-sm"
          >
            Registry URL template
            <Input
              id="registry-template"
              aria-label="Registry URL template"
              placeholder="https://registry.example/r/{name}.json"
              value={template}
              onChange={(event) => {
                setTemplate(event.target.value);
              }}
            />
          </label>
        )}
        <p className="text-muted-foreground text-xs">
          Use the publisher’s native EVE address. Third-party application
          requirements are not inferred from the source name.
        </p>
        {error !== undefined && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        <Button type="submit" variant="outline" size="sm">
          Add capability
        </Button>
      </form>
    </details>
  );
};
