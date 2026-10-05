"use client";

import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Search } from "lucide-react";
import type { JSX as ReactJSX } from "react";
import React, { useDeferredValue, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTRPC } from "@/trpc/react";

import { ModelsTable } from "./models-table";
import { SettingsPageContent, SettingsPageScrollArea } from "./settings-page";
/* oxlint-disable react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, typescript/prefer-readonly-parameter-types -- ModelsSettings: react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including event). */

export const ModelsSettings = (): ReactJSX.Element => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);

  return (
    <SettingsPageContent className="gap-4">
      <div className="relative flex shrink-0 gap-4">
        <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
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
          <RefreshCw className="size-4" />
        </Button>
      </div>

      <SettingsPageScrollArea>
        <ModelsTable className="block px-4" search={deferredSearch} />
      </SettingsPageScrollArea>
    </SettingsPageContent>
  );
};
/* oxlint-enable react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, typescript/prefer-readonly-parameter-types */
