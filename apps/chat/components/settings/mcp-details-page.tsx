"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  BookText,
  ChevronLeft,
  FileText,
  Loader2,
  Trash2,
  Wrench,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { InternalLink } from "@/components/internal-link";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useTRPC } from "@/trpc/react";

import { ConnectorHeader } from "./connector-header";
import { McpConnectDialog } from "./mcp-connect-dialog";
import { SettingsPageContent } from "./settings-page";

const HTTP_STATUS_REGEX = /HTTP (\d{3})/;

function formatMcpError(message: string): string {
  const httpMatch = message.match(HTTP_STATUS_REGEX);
  if (httpMatch) {
    const status = httpMatch[1];
    if (status === "502") {
      return "MCP server is temporarily unavailable (502 Bad Gateway)";
    }
    if (status === "503") {
      return "MCP server is temporarily unavailable (503 Service Unavailable)";
    }
    if (status === "504") {
      return "MCP server timed out (504 Gateway Timeout)";
    }
    if (status === "500") {
      return "MCP server encountered an internal error (500)";
    }
    if (status === "401" || status === "403") {
      return "Authentication failed. Try reconnecting.";
    }
    return `MCP server returned HTTP ${status}`;
  }
  if (message.length > 200) {
    return `${message.slice(0, 200)}...`;
  }
  return message;
}

export function McpDetailsPage({ connectorId }: { connectorId: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [connectOpen, setConnectOpen] = useState(false);

  const queryKey = trpc.mcp.list.queryKey();

  const { data: connectors, isLoading: isLoadingConnectors } = useQuery(
    trpc.mcp.list.queryOptions()
  );

  const connector = useMemo(
    () => connectors?.find((c) => c.id === connectorId) ?? null,
    [connectors, connectorId]
  );

  const canEdit = connector?.userId !== null;

  const { mutate: toggleEnabled } = useMutation(
    trpc.mcp.toggleEnabled.mutationOptions({
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
      onError: (_err, _newData, context) => {
        queryClient.setQueryData(queryKey, context?.prev);
        toast.error("Failed to update connector");
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey });
      },
    })
  );

  const { mutate: deleteConnector } = useMutation(
    trpc.mcp.delete.mutationOptions({
      onMutate: async (data) => {
        await queryClient.cancelQueries({ queryKey });
        const prev = queryClient.getQueryData(queryKey);
        queryClient.setQueryData(queryKey, (old: typeof connectors) => {
          if (!old) {
            return old;
          }
          return old.filter((c) => c.id !== data.id);
        });
        return { prev };
      },
      onError: (_err, _data, context) => {
        queryClient.setQueryData(queryKey, context?.prev);
        toast.error("Failed to uninstall connector");
      },
      onSuccess: () => {
        toast.success("Connector uninstalled");
        router.push("/settings/connectors");
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey });
      },
    })
  );

  const {
    data: discovery,
    isLoading: isLoadingDiscovery,
    error: discoveryError,
    refetch: refetchDiscovery,
  } = useQuery({
    ...trpc.mcp.discover.queryOptions({ id: connectorId }),
    enabled: connector !== null,
    retry: false,
  });

  const { data: authStatus } = useQuery({
    ...trpc.mcp.checkAuth.queryOptions({ id: connectorId }),
    enabled: connector !== null,
    staleTime: 30_000,
  });

  const { data: connectionStatus } = useQuery({
    ...trpc.mcp.testConnection.queryOptions({ id: connectorId }),
    enabled: connector !== null,
    staleTime: 30_000,
    retry: false,
  });

  const isAuthenticated = authStatus?.isAuthenticated ?? false;
  const isIncompatible = connectionStatus?.status === "incompatible";

  const needsOAuth =
    discoveryError?.data?.code === "UNAUTHORIZED" &&
    discoveryError.message.includes("OAuth authorization");

  useEffect(() => {
    const connected = searchParams.get("connected");
    const err = searchParams.get("error");

    if (connected) {
      toast.success("Authorization successful");
    }
    if (err) {
      toast.error(err);
    }

    if (connected || err) {
      router.replace(`/settings/connectors/${connectorId}`);
      queryClient.invalidateQueries({
        queryKey: trpc.mcp.checkAuth.queryKey({ id: connectorId }),
      });
      queryClient.invalidateQueries({
        queryKey: trpc.mcp.discover.queryKey({ id: connectorId }),
      });
      refetchDiscovery();
    }
  }, [
    connectorId,
    queryClient,
    refetchDiscovery,
    router,
    searchParams,
    trpc.mcp.checkAuth,
    trpc.mcp.discover,
  ]);

  useEffect(() => {
    if (!(connector && isAuthenticated)) {
      return;
    }
    queryClient.invalidateQueries({
      queryKey: trpc.mcp.discover.queryKey({ id: connector.id }),
    });
    refetchDiscovery();
  }, [
    connector,
    isAuthenticated,
    queryClient,
    refetchDiscovery,
    trpc.mcp.discover,
  ]);

  const handleToggleEnabled = useCallback(
    (enabled: boolean) => {
      if (!connector) {
        return;
      }
      toggleEnabled({ id: connector.id, enabled });
    },
    [connector, toggleEnabled]
  );

  const handleUninstall = useCallback(() => {
    if (!connector) {
      return;
    }
    deleteConnector({ id: connector.id });
  }, [connector, deleteConnector]);

  if (isLoadingConnectors) {
    return (
      <SettingsPageContent className="gap-4">
        <div className="animate-pulse space-y-3">
          {[1, 2].map((i) => (
            <div className="bg-muted/50 h-20 rounded-lg" key={i} />
          ))}
        </div>
      </SettingsPageContent>
    );
  }

  if (!connector) {
    return (
      <SettingsPageContent className="gap-4">
        <Button asChild className="w-fit" size="sm" variant="ghost">
          <InternalLink href="/settings/connectors">
            <ChevronLeft className="size-4" />
            Back
          </InternalLink>
        </Button>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="text-destructive size-6" />
          <p className="mt-2 text-sm font-medium">Connector not found</p>
          <p className="text-muted-foreground mt-1 text-xs">
            It may have been deleted or you don’t have access.
          </p>
        </div>
      </SettingsPageContent>
    );
  }

  const showConnectButton = needsOAuth && !isAuthenticated && !isIncompatible;
  const showDiscovery = discovery && !needsOAuth && !isIncompatible;

  return (
    <SettingsPageContent className="gap-4">
      <Button asChild className="w-fit" size="sm" variant="ghost">
        <InternalLink href="/settings/connectors">
          <ChevronLeft className="size-4" />
          Back
        </InternalLink>
      </Button>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <ConnectorHeader
          isCustom={connector.userId !== null}
          name={connector.name}
          type={connector.type}
          url={connector.url}
        />

        <div className="flex shrink-0 items-center gap-6">
          <div className="flex items-center gap-2">
            <Switch
              checked={connector.enabled}
              disabled={!canEdit}
              id="connector-enabled"
              onCheckedChange={handleToggleEnabled}
            />
            <Label
              className="text-muted-foreground text-xs"
              htmlFor="connector-enabled"
            >
              Enabled
            </Label>
          </div>

          {canEdit ? (
            <Button onClick={handleUninstall} size="sm" variant="destructive">
              <Trash2 className="size-4" />
              Uninstall
            </Button>
          ) : null}
        </div>
      </div>

      <Separator className="my-2" />

      <DiscoveryContent
        connectionError={connectionStatus?.error}
        discovery={discovery ?? null}
        discoveryError={discoveryError}
        isIncompatible={isIncompatible}
        isLoading={(needsOAuth && isAuthenticated) || isLoadingDiscovery}
        needsOAuth={needsOAuth}
        onConnect={() => setConnectOpen(true)}
        showConnectButton={showConnectButton}
        showDiscovery={showDiscovery ?? false}
      />

      <McpConnectDialog
        connector={connector}
        onClose={() => setConnectOpen(false)}
        open={connectOpen}
      />
    </SettingsPageContent>
  );
}

function DiscoveryContent({
  isLoading,
  showConnectButton,
  onConnect,
  isIncompatible,
  connectionError,
  discoveryError,
  needsOAuth,
  showDiscovery,
  discovery,
}: {
  isLoading: boolean;
  showConnectButton: boolean;
  onConnect: () => void;
  isIncompatible: boolean;
  connectionError?: string;
  discoveryError: { message: string } | null;
  needsOAuth: boolean;
  showDiscovery: boolean;
  discovery: {
    tools: { name: string }[];
    resources: { name: string }[];
    prompts: { name: string }[];
  } | null;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="text-muted-foreground size-6 animate-spin" />
      </div>
    );
  }

  if (showConnectButton) {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <p className="text-sm font-medium">Authorization required</p>
        <p className="text-muted-foreground max-w-xs text-xs">
          Connect this connector to access its tools and resources.
        </p>
        <Button onClick={onConnect}>Connect</Button>
      </div>
    );
  }

  if (isIncompatible) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center">
        <AlertCircle className="text-destructive size-6" />
        <p className="text-sm font-medium">Incompatible server</p>
        <p className="text-muted-foreground max-w-xs text-xs">
          {connectionError ??
            "This server requires pre-configured OAuth credentials."}
        </p>
      </div>
    );
  }

  if (discoveryError && !needsOAuth) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center">
        <AlertCircle className="text-destructive size-6" />
        <p className="text-muted-foreground text-sm">
          Failed to connect to MCP server
        </p>
        <p className="text-muted-foreground max-w-xs text-xs">
          {formatMcpError(discoveryError.message)}
        </p>
      </div>
    );
  }

  if (showDiscovery && discovery) {
    return (
      <ScrollArea className="max-h-[60vh]">
        <div className="space-y-4">
          <DetailsSection
            icon={<Wrench className="size-4" />}
            items={discovery.tools.map((t) => t.name)}
            title="Tools"
          />
          <DetailsSection
            icon={<FileText className="size-4" />}
            items={discovery.resources.map((r) => r.name)}
            title="Resources"
          />
          <DetailsSection
            icon={<BookText className="size-4" />}
            items={discovery.prompts.map((p) => p.name)}
            title="Prompts"
          />
        </div>
      </ScrollArea>
    );
  }

  return null;
}

function DetailsSection({
  title,
  icon,
  items,
}: {
  title: string;
  icon: React.ReactNode;
  items: string[];
}) {
  const count = items.length;

  return (
    <div className="bg-card rounded-lg border p-3">
      <div className="flex items-center gap-2">
        <div className="text-muted-foreground">{icon}</div>
        <span className="text-sm font-medium">{title}</span>
        <span className="text-muted-foreground text-xs">({count})</span>
      </div>
      <Separator className="my-3" />
      {count === 0 ? (
        <p className="text-muted-foreground text-xs italic">None available</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {items.map((name) => (
            <span
              className="bg-muted rounded-md px-2 py-1 font-mono text-xs"
              key={name}
              title={name}
            >
              {name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
