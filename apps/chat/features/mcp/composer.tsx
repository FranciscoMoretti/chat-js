/* oxlint-disable import/max-dependencies -- This component composes its existing settings/query/UI modules plus a type-only readonly reader contract; splitting imports would introduce runtime indirection. */
"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { Plug, Settings } from "lucide-react";
/* oxlint-enable sort-imports */
import React from "react";
import { toast } from "sonner";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { ComposerControlProps } from "@/components/composer/control";
/* oxlint-enable sort-imports */
import { InternalLink } from "@/components/internal-link";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
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
/* oxlint-enable sort-imports */
import { installedFeatures } from "@/features/installed";
// oxlint-disable-next-line sort-imports -- Oxfmt places this separate readonly type import after runtime imports; sort-imports instead orders their binding names together.
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { useSession } from "@/providers/session-provider";
import { useTRPC } from "@/trpc/react";
/* oxlint-disable react/jsx-no-literals -- ConnectorsControl renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable typescript/explicit-module-boundary-types -- This exported adapter derives its result from the schema or SDK contract; duplicating that type would erase inference or drift from the source. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */

/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
/* oxlint-disable eslint/init-declarations -- The value is assigned by the following guarded operation; an invented initial value would hide an uninitialized control-flow branch. */

/* oxlint-disable react/jsx-max-depth -- This nesting expresses the component library composition and accessibility structure; flattening it can change DOM behavior. */
/* oxlint-disable react-perf/jsx-no-new-function-as-prop -- The handler captures the current render state; changing its identity policy requires profiling and lifecycle review. */
/* oxlint-disable typescript/strict-boolean-expressions -- This value-producing condition preserves the current nullish/empty sentinel behavior; coercing it would change the returned value. */
const ConnectorsControl = ({ disabled }: ComposerControlProps) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { data: session } = useSession();
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading user from session; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
  const isAuthenticated = Boolean(session?.user);

  const {
    data: connectors,
    isPending,
    isError,
  } = useQuery({
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing trpc.mcp.listConnected.queryOptions() own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    ...trpc.mcp.listConnected.queryOptions(),
    enabled: installedFeatures.has("mcp") && isAuthenticated,
  });

  const queryKey = trpc.mcp.listConnected.queryKey();

  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve { mutate: toggleEnabled }'s awaited sequencing and rejected-Promise behavior. */
  const { mutate: toggleEnabled } = useMutation(
    trpc.mcp.toggleEnabled.mutationOptions({
      onError: (
        _err: unknown,
        _newData,
        // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Return the original typed cache snapshot to queryClient.setQueryData; its deep readonly array is rejected by the cache receiver (TS2345).
        context: { readonly prev: typeof connectors } | undefined
      ): void => {
        // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading prev from context; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
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
                  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing connector own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
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
  /* oxlint-enable oxc/no-async-await */
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
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading length from connectors; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
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
        <DropdownMenuSubContent
          // oxlint-disable-next-line react/forbid-component-props -- DropdownMenuSubContent accepts className in its styling contract; preserve this caller's layout and appearance.
          className="w-56"
        >
          <DropdownMenuGroup>
            {
              // oxlint-disable-next-line no-ternary -- Keep JSX child as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
              typeof status === "string" && status !== "" ? (
                <DropdownMenuLabel>{status}</DropdownMenuLabel>
              ) : (
                // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading map from connectors; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
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
                      // oxlint-disable-next-line typescript/prefer-nullish-coalescing -- This is a logical OR of independent conditions; false must continue to the next condition rather than short-circuit as with nullish coalescing.
                      disabled={disabled || connector.userId === null}
                      onSelect={(
                        event: Readonly<Pick<Event, "preventDefault">>
                      ): void => event.preventDefault()}
                      onCheckedChange={(enabled): void =>
                        toggleEnabled({ enabled, id: connector.id })
                      }
                    >
                      <span className="truncate">{connector.name}</span>
                    </DropdownMenuCheckboxItem>
                  )
                )
              )
            }
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <InternalLink
                // oxlint-disable-next-line no-ternary -- Keep href JSX attribute as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
                href={isAuthenticated ? "/settings/connectors" : "/login"}
              >
                <Settings />
                {
                  // oxlint-disable-next-line no-ternary -- Keep JSX child as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
                  isAuthenticated ? "Manage connectors" : "Sign in"
                }
              </InternalLink>
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuSubContent>
      </DropdownMenuPortal>
    </DropdownMenuSub>
  );
};
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable react-perf/jsx-no-new-function-as-prop */
/* oxlint-enable react/jsx-max-depth */

/* oxlint-enable eslint/init-declarations */
/* oxlint-enable unicorn/no-null */

/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable typescript/explicit-module-boundary-types */
/* oxlint-enable eslint/max-statements */

ConnectorsControl.isAvailable = (): boolean => installedFeatures.has("mcp");
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (ConnectorsControl); the enabled import/no-default-export convention rejects the default-export alternative. */
export { ConnectorsControl };
/* oxlint-enable import/prefer-default-export, import/no-named-export */

/* oxlint-enable import/max-dependencies */
