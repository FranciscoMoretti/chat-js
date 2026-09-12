"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Globe, Plug, Settings } from "lucide-react";
import { memo } from "react";
import { toast } from "sonner";

import { InternalLink } from "@/components/internal-link";
import { config } from "@/lib/config";
import { useSession } from "@/providers/session-provider";
import { useTRPC } from "@/trpc/react";

import { Favicon } from "./favicon";
import { getGoogleFaviconUrl } from "./get-google-favicon-url";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Switch } from "./ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

const PureConnectorsDropdown = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { data: session } = useSession();
  const isAuthenticated = !!session?.user;

  const { data: connectors } = useQuery({
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
  if (!connectors || connectors.length === 0) {
    return null;
  }

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              className="h-8 gap-1 p-1.5 px-2.5 @[500px]:h-10 @[500px]:gap-2"
              size="sm"
              variant="ghost"
            >
              <Plug size={14} />
              <span className="hidden @[500px]:inline">Connectors</span>
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>MCP Connectors</TooltipContent>
      </Tooltip>
      <DropdownMenuContent
        align="start"
        className="w-56"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {connectors.map((connector) => {
          const faviconUrl =
            connector.type === "http" ? getGoogleFaviconUrl(connector.url) : "";
          return (
            <DropdownMenuItem
              className="flex items-center gap-2"
              key={connector.id}
              onSelect={(e) => e.preventDefault()}
            >
              <div className="flex size-5 shrink-0 items-center justify-center">
                {faviconUrl ? (
                  <>
                    <Favicon className="size-4 rounded-sm" url={faviconUrl} />
                    <Globe className="text-muted-foreground hidden size-4" />
                  </>
                ) : (
                  <Globe className="text-muted-foreground size-4" />
                )}
              </div>
              <span className="flex-1 truncate text-sm">{connector.name}</span>
              <Switch
                checked={connector.enabled}
                className="scale-75"
                onCheckedChange={(enabled) =>
                  toggleEnabled({
                    enabled,
                    id: connector.id,
                  })
                }
                onClick={(e) => e.stopPropagation()}
              />
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <InternalLink
            className="flex items-center gap-2"
            href="/settings/connectors"
          >
            <Settings className="size-4" />
            <span>Manage Connectors</span>
          </InternalLink>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const ConnectorsDropdown = memo(PureConnectorsDropdown);
