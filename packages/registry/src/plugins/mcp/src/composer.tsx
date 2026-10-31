"use client";
import { MenuLink } from "@/components/navigation-links";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plug, Settings } from "lucide-react";
import type { ComposerControlProps } from "@/components/composer/control";
import React from "react";
import { toast } from "sonner";

import { ConnectorMenuItem } from "./connector-menu-item";

import {
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { installedPlugins } from "@/integrations/plugin-catalog";
import { useSession } from "@/providers/session-provider";
import { useTRPC } from "@/trpc/react";

const ConnectorsControl = ({
  disabled,
}: ComposerControlProps): React.JSX.Element | null => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { data: session } = useSession();
  const isAuthenticated = Boolean(session?.user);

  const {
    data: connectors,
    isPending,
    isError,
  } = useQuery({
    ...trpc.mcp.listConnected.queryOptions(),
    enabled: installedPlugins.has("mcp") && isAuthenticated,
  });

  const queryKey = trpc.mcp.listConnected.queryKey();

  const { mutate: toggleEnabled } = useMutation(
    trpc.mcp.toggleEnabled.mutationOptions({
      onError: (
        _err: unknown,
        _newData,
        context: { readonly prev: typeof connectors } | undefined
      ): void => {
        queryClient.setQueryData(queryKey, context?.prev);
        toast.error("Failed to update connector");
      },
      onMutate: async (newData) => {
        await queryClient.cancelQueries({ queryKey });
        const prev = queryClient.getQueryData(queryKey);
        queryClient.setQueryData(
          queryKey,
          (old: ReadonlyNativeSurface<typeof connectors>) => {
            if (!old) {
              return old;
            }
            return old.map(
              (
                connector: ReadonlyNativeSurface<
                  NonNullable<typeof connectors>[number]
                >
              ) => {
                if (connector.id === newData.id) {
                  return { ...connector, enabled: newData.enabled };
                }
                return connector;
              }
            );
          }
        );
        return { prev };
      },
      onSettled: (): void => {
        void queryClient.invalidateQueries({ queryKey });
      },
    })
  );
  if (!installedPlugins.has("mcp")) {
    return null;
  }
  let status: string | undefined;
  if (!isAuthenticated) {
    status = "Sign in to use connectors";
  } else if (isPending) {
    status = "Loading connectors…";
  } else if (isError) {
    status = "Could not load connectors";
  } else if (!connectors?.length) {
    status = "No connected servers";
  }
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger disabled={disabled}>
        <Plug />
        Connectors
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-56">
        <DropdownMenuGroup>
          {typeof status === "string" && status !== "" ? (
            <DropdownMenuLabel>{status}</DropdownMenuLabel>
          ) : (
            connectors?.map(
              (connector: {
                readonly id: string;
                readonly enabled: boolean;
                readonly userId: string | null;
                readonly name: string;
              }) => (
                <ConnectorMenuItem
                  key={connector.id}
                  checked={connector.enabled}
                  disabled={disabled === true || connector.userId === null}
                  onActivate={() => {
                    toggleEnabled({
                      enabled: !connector.enabled,
                      id: connector.id,
                    });
                  }}
                >
                  <span className="truncate">{connector.name}</span>
                </ConnectorMenuItem>
              )
            )
          )}
          <DropdownMenuSeparator />
          <MenuLink href={isAuthenticated ? "/settings/connectors" : "/login"}>
            <Settings />
            {isAuthenticated ? "Manage connectors" : "Sign in"}
          </MenuLink>
        </DropdownMenuGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
};

ConnectorsControl.isAvailable = (): boolean => installedPlugins.has("mcp");
export { ConnectorsControl };
