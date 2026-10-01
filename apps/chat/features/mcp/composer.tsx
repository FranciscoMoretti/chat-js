"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plug, Settings } from "lucide-react";
import { toast } from "sonner";

import type { ComposerControlProps } from "@/components/composer/control";
import { InternalLink } from "@/components/internal-link";
import {
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { config } from "@/lib/config";
import { useSession } from "@/providers/session-provider";
import { useTRPC } from "@/trpc/react";

export const ConnectorsControl = ({ disabled }: ComposerControlProps) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { data: session } = useSession();
  const isAuthenticated = !!session?.user;

  const {
    data: connectors,
    isPending,
    isError,
  } = useQuery({
    ...trpc.mcp.listConnected.queryOptions(),
    enabled: config.ai.tools.mcp.enabled && isAuthenticated,
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
        queryClient.invalidateQueries({ queryKey });
      },
    })
  );

  if (!config.ai.tools.mcp.enabled) {
    return null;
  }
  let status: string | undefined;
  if (isPending) {
    status = "Loading connectors…";
  } else if (isError) {
    status = "Could not load connectors";
  } else if (!connectors?.length) {
    status = "No connected servers";
  }
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger disabled={disabled || !isAuthenticated}>
        <Plug className="size-4" />
        Connectors
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-56">
        {status ? (
          <DropdownMenuLabel>{status}</DropdownMenuLabel>
        ) : (
          connectors?.map((connector) => (
            <DropdownMenuCheckboxItem
              key={connector.id}
              checked={connector.enabled}
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
          <InternalLink href="/settings/connectors">
            <Settings />
            Manage connectors
          </InternalLink>
        </DropdownMenuItem>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
};

ConnectorsControl.isAvailable = () => config.ai.tools.mcp.enabled;
