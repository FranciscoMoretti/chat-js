"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plug, Settings } from "lucide-react";
import { toast } from "sonner";

import type { ComposerControlProps } from "@/components/composer/control";
import { InternalLink } from "@/components/internal-link";
import {
  DropdownMenuPortal,
  DropdownMenuGroup,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { installedFeatures } from "@/features/installed";
import { useSession } from "@/providers/session-provider";
import { useTRPC } from "@/trpc/react";

export const ConnectorsControl = ({ disabled }: ComposerControlProps) => {
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
        _err,
        _newData,
        context: { prev: typeof connectors } | undefined
      ) => {
        queryClient.setQueryData(queryKey, context?.prev);
        toast.error("Failed to update connector");
      },
      onMutate: async (newData) => {
        await queryClient.cancelQueries({ queryKey });
        const prev = queryClient.getQueryData(queryKey);
        queryClient.setQueryData(queryKey, (old: typeof connectors) => {
          if (!old) {
            return old;
          }
          return old.map((c) =>
            c.id === newData.id ? { ...c, enabled: newData.enabled } : c
          );
        });
        return { prev };
      },
      onSettled: () => {
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
            {status ? (
              <DropdownMenuLabel>{status}</DropdownMenuLabel>
            ) : (
              connectors?.map((connector) => (
                <DropdownMenuCheckboxItem
                  key={connector.id}
                  checked={connector.enabled}
                  // oxlint-disable-next-line typescript/prefer-nullish-coalescing -- This is a logical OR of independent conditions; false must continue to the next condition rather than short-circuit as with nullish coalescing.
                  disabled={disabled || connector.userId === null}
                  onSelect={(event) => event.preventDefault()}
                  onCheckedChange={(enabled) =>
                    toggleEnabled({ enabled, id: connector.id })
                  }
                >
                  <span className="truncate">{connector.name}</span>
                </DropdownMenuCheckboxItem>
              ))
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

ConnectorsControl.isAvailable = () => installedFeatures.has("mcp");
