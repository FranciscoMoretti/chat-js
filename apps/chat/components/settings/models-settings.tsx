"use client";

import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Search } from "lucide-react";
import { useDeferredValue, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTRPC } from "@/trpc/react";

import { ModelsTable } from "./models-table";
import { SettingsPageContent, SettingsPageScrollArea } from "./settings-page";

export const ModelsSettings = () => {
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
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search model"
          value={search}
        />
        <Button
          onClick={() =>
            queryClient.invalidateQueries({
              queryKey: trpc.settings.getModelPreferences.queryKey(),
            })
          }
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
