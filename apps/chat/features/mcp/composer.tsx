"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plug, Settings } from "lucide-react";
import type { ComposerControlProps } from "@/components/composer/control";
import React from "react";
import { toast } from "sonner";

import { InternalLink } from "@/components/internal-link";

import {
  DropdownMenuCheckboxItem,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { installedFeatures } from "@/features/installed";
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
    enabled: installedFeatures.has("mcp") && isAuthenticated,
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
  if (!installedFeatures.has("mcp")) {
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
      <DropdownMenuPortal>
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
                  <DropdownMenuCheckboxItem
                    key={connector.id}
                    checked={connector.enabled}
                    disabled={disabled === true || connector.userId === null}
                    onSelect={(
                      event: Readonly<Pick<Event, "preventDefault">>
                    ): void => {
                      event.preventDefault();
                    }}
                    onCheckedChange={(enabled): void => {
                      toggleEnabled({ enabled, id: connector.id });
                    }}
                  >
                    <span className="truncate">{connector.name}</span>
                  </DropdownMenuCheckboxItem>
                )
              )
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <InternalLink
                href={isAuthenticated ? "/settings/connectors" : "/login"}
              >
                <Settings />
                {isAuthenticated ? "Manage connectors" : "Sign in"}
              </InternalLink>
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuSubContent>
      </DropdownMenuPortal>
    </DropdownMenuSub>
  );
};

ConnectorsControl.isAvailable = (): boolean => installedFeatures.has("mcp");
export { ConnectorsControl };
