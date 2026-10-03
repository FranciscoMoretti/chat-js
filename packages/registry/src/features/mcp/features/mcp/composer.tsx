"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plug, Settings } from "lucide-react";
import React from "react";
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

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable typescript/explicit-module-boundary-types -- This exported adapter derives its result from the schema or SDK contract; duplicating that type would erase inference or drift from the source. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable eslint/id-length -- Short callback indices and coordinate keys match the surrounding collection or external data shape; renaming public keys would change the contract. */
/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
/* oxlint-disable eslint/init-declarations -- The value is assigned by the following guarded operation; an invented initial value would hide an uninitialized control-flow branch. */

/* oxlint-disable react/jsx-max-depth -- This nesting expresses the component library composition and accessibility structure; flattening it can change DOM behavior. */
/* oxlint-disable react-perf/jsx-no-new-function-as-prop -- The handler captures the current render state; changing its identity policy requires profiling and lifecycle review. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/* oxlint-disable typescript/strict-boolean-expressions -- This value-producing condition preserves the current nullish/empty sentinel behavior; coercing it would change the returned value. */
const ConnectorsControl = ({ disabled }: ComposerControlProps) => {
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
      ): void => {
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
              connectors?.map((connector) => (
                <DropdownMenuCheckboxItem
                  key={connector.id}
                  checked={connector.enabled}
                  // oxlint-disable-next-line typescript/prefer-nullish-coalescing -- This is a logical OR of independent conditions; false must continue to the next condition rather than short-circuit as with nullish coalescing.
                  disabled={disabled || connector.userId === null}
                  onSelect={(event): void => event.preventDefault()}
                  onCheckedChange={(enabled): void =>
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
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable react-perf/jsx-no-new-function-as-prop */
/* oxlint-enable react/jsx-max-depth */

/* oxlint-enable eslint/init-declarations */
/* oxlint-enable unicorn/no-null */
/* oxlint-enable eslint/id-length */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable typescript/explicit-module-boundary-types */
/* oxlint-enable eslint/max-statements */

ConnectorsControl.isAvailable = (): boolean => installedFeatures.has("mcp");
export { ConnectorsControl };
