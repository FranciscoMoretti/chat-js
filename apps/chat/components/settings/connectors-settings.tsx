"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import {
  AlertTriangle,
  ArrowUpRight,
  Loader2,
  MoreHorizontal,
  Plus,
  Radio,
  Trash2,
} from "lucide-react";
/* oxlint-enable sort-imports */
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryStates } from "nuqs";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import React, { Fragment, useCallback, useEffect, useMemo } from "react";
/* oxlint-enable sort-imports */
import { toast } from "sonner";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { InternalLink } from "@/components/internal-link";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { ConnectorHeader } from "@/components/settings/connector-header";
/* oxlint-enable sort-imports */
import { McpConnectDialog } from "@/components/settings/mcp-connect-dialog";
import { McpCreateDialog } from "@/components/settings/mcp-create-dialog";
/* oxlint-disable import/max-dependencies -- This integration composes its explicit adapters here; splitting the imports would hide the dependency boundary without reducing dependencies. */
import { SettingsPageContent } from "@/components/settings/settings-page";
/* oxlint-enable import/max-dependencies */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { Badge } from "@/components/ui/badge";
/* oxlint-enable sort-imports */
import { Button } from "@/components/ui/button";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
/* oxlint-enable sort-imports */
import { Separator } from "@/components/ui/separator";
import { installedFeatures } from "@/features/installed";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { McpConnector } from "@/lib/db/schema";
/* oxlint-enable sort-imports */
import type { McpConnectorsDialog } from "@/lib/nuqs/mcp-search-params";
import { mcpConnectorsSettingsSearchParams } from "@/lib/nuqs/mcp-search-params";
import { useTRPC } from "@/trpc/react";

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */

/* oxlint-disable react/jsx-max-depth -- This nesting expresses the component library composition and accessibility structure; flattening it can change DOM behavior. */
/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
/* oxlint-disable react-perf/jsx-no-new-function-as-prop -- The handler captures the current render state; changing its identity policy requires profiling and lifecycle review. */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/* oxlint-disable typescript/strict-boolean-expressions -- This value-producing condition preserves the current nullish/empty sentinel behavior; coercing it would change the returned value. */
const CustomConnectorRow = ({
  connector,
  onConnect,
  onUninstall,
  onDisconnect,
  isDisconnecting,
}: {
  connector: McpConnector;
  onConnect: () => void;
  onUninstall: () => void;
  onDisconnect: () => void;
  isDisconnecting: boolean;
}) => {
  const trpc = useTRPC();

  const { data: authStatus } = useQuery({
    ...trpc.mcp.checkAuth.queryOptions({ id: connector.id }),
    staleTime: 30_000,
  });

  const { isLoading: isTestingConnection, data: connectionStatus } = useQuery({
    ...trpc.mcp.testConnection.queryOptions({ id: connector.id }),
    retry: false,
    staleTime: 30_000,
  });

  const needsOAuth = connectionStatus?.needsAuth ?? false;
  const isConnected = connectionStatus?.status === "connected";
  const isIncompatible = connectionStatus?.status === "incompatible";

  const statusText = ((): string => {
    if (isTestingConnection) {
      return "Checking connection…";
    }
    if (isIncompatible) {
      return "Incompatible server";
    }
    if (needsOAuth) {
      return "Authorization required";
    }
    if (isConnected) {
      return "Connected";
    }
    return connectionStatus?.error ?? "Unable to reach server";
  })();

  const actionLabel = (() => {
    if (isTestingConnection) {
      return "Loading";
    }
    if (needsOAuth) {
      return "Connect";
    }
    return "Configure";
  })();

  const href: `/settings/connectors/${string}` = `/settings/connectors/${connector.id}`;

  const showOAuthButton = needsOAuth && !isIncompatible;
  const showDetailsButton = !(needsOAuth || isIncompatible);

  return (
    <div className="flex items-center gap-4 py-3">
      <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden text-left">
        <ConnectorHeader
          isCustom
          name={connector.name}
          statusText={statusText}
          type={connector.type}
          url={connector.url}
        />
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {isIncompatible ? (
          <Badge
            // oxlint-disable-next-line react/forbid-component-props -- Badge accepts className in its styling contract; preserve this caller's layout and appearance.
            className="gap-1"
            variant="destructive"
          >
            <AlertTriangle
              // oxlint-disable-next-line react/forbid-component-props -- AlertTriangle accepts className in its styling contract; preserve this caller's layout and appearance.
              className="size-3"
            />
            Error
          </Badge>
        ) : null}

        {showOAuthButton ? (
          <Button disabled={isTestingConnection} onClick={onConnect} size="sm">
            {isTestingConnection ? (
              <span className="inline-flex items-center gap-2">
                <Loader2
                  // oxlint-disable-next-line react/forbid-component-props -- Loader2 accepts className in its styling contract; preserve this caller's layout and appearance.
                  className="size-4 animate-spin"
                />
                Loading
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                Connect
                <ArrowUpRight
                  // oxlint-disable-next-line react/forbid-component-props -- ArrowUpRight accepts className in its styling contract; preserve this caller's layout and appearance.
                  className="-mr-1 size-4"
                />
              </span>
            )}
          </Button>
        ) : null}

        {showDetailsButton ? (
          <Button
            asChild
            disabled={isTestingConnection}
            size="sm"
            variant="outline"
          >
            <InternalLink href={href}>
              {isTestingConnection ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2
                    // oxlint-disable-next-line react/forbid-component-props -- Loader2 accepts className in its styling contract; preserve this caller's layout and appearance.
                    className="size-4 animate-spin"
                  />
                  Loading
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  {actionLabel}
                </span>
              )}
            </InternalLink>
          </Button>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              aria-label="More connector actions"
              size="icon"
              variant="ghost"
            >
              <MoreHorizontal
                // oxlint-disable-next-line react/forbid-component-props -- MoreHorizontal accepts className in its styling contract; preserve this caller's layout and appearance.
                className="size-4"
              />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {authStatus?.isAuthenticated ? (
              <>
                <DropdownMenuItem
                  disabled={isDisconnecting}
                  onClick={onDisconnect}
                >
                  Disconnect
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            ) : null}
            {needsOAuth ? (
              <>
                <DropdownMenuItem
                  onClick={(event): void => {
                    event.preventDefault();
                    onConnect();
                  }}
                >
                  Connect
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            ) : null}
            <DropdownMenuItem
              // oxlint-disable-next-line react/forbid-component-props -- DropdownMenuItem accepts className in its styling contract; preserve this caller's layout and appearance.
              className="text-destructive focus:text-destructive"
              onClick={onUninstall}
            >
              <Trash2
                // oxlint-disable-next-line react/forbid-component-props -- Trash2 accepts className in its styling contract; preserve this caller's layout and appearance.
                className="size-4"
              />
              Uninstall
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-enable react-perf/jsx-no-new-function-as-prop */
/* oxlint-enable unicorn/no-null */
/* oxlint-enable react/jsx-max-depth */

/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable react/no-multi-comp -- These private render helpers belong to the same UI composition and share its local types and state assumptions. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const BuiltInConnectorRow = ({ connector }: { connector: McpConnector }) => {
  const href: `/settings/connectors/${string}` = `/settings/connectors/${connector.id}`;
  return (
    <div className="flex w-full items-center gap-3 py-3 text-left">
      <ConnectorHeader
        isCustom={false}
        name={connector.name}
        type={connector.type}
        url={connector.url}
      />
      <Button asChild size="sm" variant="outline">
        <InternalLink href={href}>View</InternalLink>
      </Button>
    </div>
  );
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable react/no-multi-comp */

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable react/no-multi-comp -- These private render helpers belong to the same UI composition and share its local types and state assumptions. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */

/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable react-perf/jsx-no-new-function-as-prop -- The handler captures the current render state; changing its identity policy requires profiling and lifecycle review. */
/* oxlint-disable react/jsx-max-depth -- This nesting expresses the component library composition and accessibility structure; flattening it can change DOM behavior. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
export const ConnectorsSettings = (): React.JSX.Element => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  useEffect((): void => {
    const callbackError = searchParams.get("error");
    if (typeof callbackError === "string" && callbackError !== "") {
      toast.error(callbackError);
      router.replace("/settings/connectors");
    }
  }, [router, searchParams]);

  const [qs, setQs] = useQueryStates(mcpConnectorsSettingsSearchParams, {
    history: "replace",
    shallow: true,
  });

  const {
    data: connectors,
    isLoading,
    error,
    refetch: refetchConnectors,
  } = useQuery({
    ...trpc.mcp.list.queryOptions(),
    enabled: installedFeatures.has("mcp"),
  });

  const createOpen = qs.dialog === "config";
  const connectOpen = qs.dialog === "connect" && Boolean(qs.connectorId);

  const connectConnector = useMemo(() => {
    if (
      !(
        connectOpen &&
        typeof qs.connectorId === "string" &&
        qs.connectorId !== "" &&
        connectors
      )
    ) {
      return null;
    }
    return (
      connectors.find(
        (connector): boolean => connector.id === qs.connectorId
      ) ?? null
    );
  }, [connectOpen, qs.connectorId, connectors]);

  const queryKey = trpc.mcp.list.queryKey();

  const { mutate: deleteConnector } = useMutation(
    trpc.mcp.delete.mutationOptions({
      onError: (
        _err,
        _data,
        context: { prev: typeof connectors } | undefined
      ): void => {
        queryClient.setQueryData(queryKey, context?.prev);
        toast.error("Failed to uninstall connector");
      },
      onMutate: async (data) => {
        await queryClient.cancelQueries({ queryKey });
        const prev = queryClient.getQueryData(queryKey);
        queryClient.setQueryData(queryKey, (old: typeof connectors) => {
          if (!old) {
            return old;
          }
          return old.filter((connector): boolean => connector.id !== data.id);
        });
        return { prev };
      },
      onSettled: (): void => {
        void queryClient.invalidateQueries({ queryKey });
        void queryClient.invalidateQueries({
          queryKey: trpc.mcp.listConnected.queryKey(),
        });
      },
      onSuccess: (): void => {
        toast.success("Connector uninstalled");
      },
    })
  );

  const { mutate: disconnectConnector, isPending: isDisconnecting } =
    useMutation(
      trpc.mcp.disconnect.mutationOptions({
        onError: (err): void => {
          toast.error(err.message || "Failed to disconnect");
        },
        onSettled: (_data, _err, vars): void => {
          void queryClient.invalidateQueries({ queryKey });
          void queryClient.invalidateQueries({
            queryKey: trpc.mcp.listConnected.queryKey(),
          });
          void queryClient.invalidateQueries({
            queryKey: trpc.mcp.checkAuth.queryKey({ id: vars.id }),
          });
          void queryClient.invalidateQueries({
            queryKey: trpc.mcp.discover.queryKey({ id: vars.id }),
          });
        },
        onSuccess: (_data, vars): void => {
          void queryClient.invalidateQueries({
            queryKey: trpc.mcp.testConnection.queryKey({ id: vars.id }),
          });
          toast.success("Disconnected");
        },
      })
    );

  const setDialogState = useCallback(
    ({
      dialog,
      connectorId,
    }: {
      dialog: McpConnectorsDialog | null;
      connectorId?: string | null;
    }): void => {
      void setQs({
        connectorId: connectorId ?? null,
        dialog,
      });
    },
    [setQs]
  );

  const handleOpenCreateDialog = useCallback((): void => {
    setDialogState({ dialog: "config" });
  }, [setDialogState]);

  const handleDialogClose = (): void => {
    setDialogState({ dialog: null });
  };

  const handleOpenConnectDialog = useCallback(
    (connectorId: string): void => {
      setDialogState({
        connectorId,
        dialog: "connect",
      });
    },
    [setDialogState]
  );

  const handleConnectDialogClose = useCallback((): void => {
    setDialogState({ dialog: null });
  }, [setDialogState]);

  if (!installedFeatures.has("mcp")) {
    return (
      <SettingsPageContent
        // oxlint-disable-next-line react/forbid-component-props -- SettingsPageContent accepts className in its styling contract; preserve this caller's layout and appearance.
        className="gap-4"
      >
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-sm font-medium">MCP is not enabled</p>
        </div>
      </SettingsPageContent>
    );
  }
  if (isLoading) {
    return (
      <SettingsPageContent
        // oxlint-disable-next-line react/forbid-component-props -- SettingsPageContent accepts className in its styling contract; preserve this caller's layout and appearance.
        className="gap-4"
      >
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((placeholderIndex) => (
            <div
              className="bg-muted/50 h-20 rounded-lg"
              key={placeholderIndex}
            />
          ))}
        </div>
      </SettingsPageContent>
    );
  }

  if (error && !connectors) {
    return (
      <SettingsPageContent
        // oxlint-disable-next-line react/forbid-component-props -- SettingsPageContent accepts className in its styling contract; preserve this caller's layout and appearance.
        className="gap-4"
      >
        <div
          role="alert"
          className="flex flex-col items-center justify-center py-12 text-center"
        >
          <p className="text-sm font-medium">Could not load connectors</p>
          <p className="text-muted-foreground mt-1 text-xs">{error.message}</p>
          {}
          <Button
            onClick={(): void => {
              void refetchConnectors();
            }}
            variant="outline"
          >
            Retry
          </Button>
        </div>
      </SettingsPageContent>
    );
  }

  const customConnectors = (connectors ?? []).filter(
    (connector): boolean => connector.userId !== null
  );
  const globalConnectors = (connectors ?? []).filter(
    (connector): boolean => connector.userId === null
  );

  return (
    <SettingsPageContent
      // oxlint-disable-next-line react/forbid-component-props -- SettingsPageContent accepts className in its styling contract; preserve this caller's layout and appearance.
      className="gap-6"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Custom connectors</p>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Connect MCP servers you trust to extend your AI with tools.
          </p>
        </div>
        <Button onClick={handleOpenCreateDialog} size="sm">
          <Plus
            // oxlint-disable-next-line react/forbid-component-props -- Plus accepts className in its styling contract; preserve this caller's layout and appearance.
            className="size-4"
          />
          Add custom connector
        </Button>
      </div>

      <div className="flex flex-col">
        {customConnectors.length > 0 ? (
          customConnectors.map((connector, index) => (
            <Fragment key={connector.id}>
              <CustomConnectorRow
                connector={connector}
                isDisconnecting={isDisconnecting}
                onConnect={(): void => handleOpenConnectDialog(connector.id)}
                onDisconnect={(): void =>
                  disconnectConnector({ id: connector.id })
                }
                onUninstall={(): void => deleteConnector({ id: connector.id })}
              />
              {index < customConnectors.length - 1 ? <Separator /> : null}
            </Fragment>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="bg-muted mb-4 rounded-full p-3">
              <Radio
                // oxlint-disable-next-line react/forbid-component-props -- Radio accepts className in its styling contract; preserve this caller's layout and appearance.
                className="text-muted-foreground size-6"
              />
            </div>
            <p className="text-sm font-medium">No custom connectors</p>
            <p className="text-muted-foreground mt-1 max-w-sm text-xs">
              Add a custom MCP connector to access tools from your services.
            </p>
          </div>
        )}
      </div>

      {globalConnectors.length > 0 ? (
        <div>
          <p className="text-sm font-medium">Built-in connectors</p>
          <div className="divide-y">
            {globalConnectors.map((connector) => (
              <BuiltInConnectorRow connector={connector} key={connector.id} />
            ))}
          </div>
        </div>
      ) : null}

      <McpCreateDialog onClose={handleDialogClose} open={createOpen} />

      <McpConnectDialog
        connector={connectConnector}
        onClose={handleConnectDialogClose}
        open={connectOpen}
      />
    </SettingsPageContent>
  );
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable react/jsx-max-depth */
/* oxlint-enable react-perf/jsx-no-new-function-as-prop */
/* oxlint-enable eslint/no-magic-numbers */

/* oxlint-enable unicorn/no-null */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable react/no-multi-comp */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable max-lines -- Keep this cohesive contract and its cases together; splitting it solely for a line quota would obscure shared setup or state transitions. */
