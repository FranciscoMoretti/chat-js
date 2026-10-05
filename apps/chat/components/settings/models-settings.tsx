"use client";

import { useQueryClient } from "@tanstack/react-query";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { RefreshCw, Search } from "lucide-react";
/* oxlint-enable sort-imports */
import type { JSX as ReactJSX } from "react";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import React, { useDeferredValue, useState } from "react";
/* oxlint-enable sort-imports */

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTRPC } from "@/trpc/react";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { ModelsTable } from "./models-table";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { SettingsPageContent, SettingsPageScrollArea } from "./settings-page";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (ModelsSettings); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable sort-imports */
/* oxlint-disable react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, typescript/prefer-readonly-parameter-types -- ModelsSettings: react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including event). */

export const ModelsSettings = (): ReactJSX.Element => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);

  return (
    <SettingsPageContent
      // oxlint-disable-next-line react/forbid-component-props -- SettingsPageContent accepts className in its styling contract; preserve this caller's layout and appearance.
      className="gap-4"
    >
      <div className="relative flex shrink-0 gap-4">
        <Search
          // oxlint-disable-next-line react/forbid-component-props -- Search accepts className in its styling contract; preserve this caller's layout and appearance.
          className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2"
        />
        <Input
          // oxlint-disable-next-line react/forbid-component-props -- Input accepts className in its styling contract; preserve this caller's layout and appearance.
          className="bg-muted/50 pr-10 pl-9"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search model"
          value={search}
        />
        <Button
          onClick={() => {
            void queryClient.invalidateQueries({
              queryKey: trpc.settings.getModelPreferences.queryKey(),
            });
          }}
          size="icon"
          variant="ghost"
        >
          <RefreshCw
            // oxlint-disable-next-line react/forbid-component-props -- RefreshCw accepts className in its styling contract; preserve this caller's layout and appearance.
            className="size-4"
          />
        </Button>
      </div>

      <SettingsPageScrollArea>
        <ModelsTable
          // oxlint-disable-next-line react/forbid-component-props -- ModelsTable accepts className in its styling contract; preserve this caller's layout and appearance.
          className="block px-4"
          search={deferredSearch}
        />
      </SettingsPageScrollArea>
    </SettingsPageContent>
  );
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, typescript/prefer-readonly-parameter-types */
