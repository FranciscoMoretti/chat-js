"use client";

import { CategoryNavigation, categoryLayout } from "./category-navigation";
import { AgentCategoryIcon } from "./agent-category-icon";
import { CapabilityRow } from "./capability-row";
import { ConfigurationSection } from "./configuration-section";
import { RegistryCapabilityForm } from "./registry-capability-form";
import { portableChatjsCapabilities } from "../../../../packages/registry/chatjs-capabilities";
import { useState } from "react";
import type { ReactNode } from "react";
import useSWR from "swr";
import {
  eveCategories,
  eveCompositionIssue,
  eveCatalogItemsSchema,
  selectedCapability,
} from "../../../../packages/registry/eve-catalog";
import type { EveCatalogItem } from "../../../../packages/registry/eve-catalog";
import { Button } from "@/vendor/shadcn-create/styles/base-nova/ui/button";
import { Input } from "@/vendor/shadcn-create/styles/base-nova/ui/input";
import { useInstallation } from "./installation-provider";

const fetchCatalog = async (url: string): Promise<EveCatalogItem[]> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      "EVE’s catalog could not be loaded. Your selections are preserved."
    );
  }
  return eveCatalogItemsSchema.parse(await response.json());
};

export const EveCatalog = ({ children }: { readonly children: ReactNode }) => {
  const { installation, update, catalog } = useInstallation();
  const { data, error, isLoading, mutate } = useSWR<EveCatalogItem[], Error>(
    "/api/eve-catalog",
    fetchCatalog,
    { revalidateOnFocus: false, shouldRetryOnError: false }
  );
  const [skillInput, setSkillInput] = useState("");
  const [skillQuery, setSkillQuery] = useState("");
  const skills = useSWR<EveCatalogItem[], Error>(
    skillQuery.length >= 2
      ? `/api/skills-catalog?q=${encodeURIComponent(skillQuery)}`
      : null,
    fetchCatalog,
    { revalidateOnFocus: false, shouldRetryOnError: false }
  );
  const [selectedOnly, setSelectedOnly] = useState(false);
  if (!installation) {
    return null;
  }
  const selected = installation.eve ?? [];
  const toggle = (id: string, checked: boolean) => {
    update({
      ...installation,
      eve: checked ? [...selected, id] : selected.filter((item) => item !== id),
    });
  };
  const knownItems = [
    ...(data ?? []),
    ...portableChatjsCapabilities(catalog),
    ...(skills.data ?? []),
  ];
  const items = [
    ...knownItems,
    ...selected
      .filter((id) => !knownItems.some((item) => item.id === id))
      .map(selectedCapability),
  ];
  const categories = new Map<string, string>(Object.entries(eveCategories));
  for (const item of items) {
    if (!categories.has(item.category)) {
      categories.set(item.category, item.category);
    }
  }
  const visible = items.filter(
    (item) => !selectedOnly || selected.includes(item.id)
  );
  const groups = [...categories]
    .map(([id, title]) => ({
      id,
      title,
      items: visible.filter((item) => item.category === id),
    }))
    .filter(
      (group) =>
        group.items.length > 0 || (group.id === "skill" && !selectedOnly)
    );
  return (
    <section aria-label="EVE catalog" className={categoryLayout}>
      <CategoryNavigation
        label="Agent categories"
        prefix="agent"
        sections={[
          ...groups.map((group) => ({
            id: group.id,
            title: group.title,
            count: group.items.length,
            icon: (
              <AgentCategoryIcon
                category={group.id}
                className="size-3.5 shrink-0"
              />
            ),
          })),
          {
            id: "sandbox",
            title: "Sandbox",
            icon: (
              <AgentCategoryIcon
                category="sandbox"
                className="size-3.5 shrink-0"
              />
            ),
          },
          {
            id: "application",
            title: "Application capabilities",
            icon: (
              <AgentCategoryIcon
                category="application"
                className="size-3.5 shrink-0"
              />
            ),
          },
        ]}
      >
        <Button
          variant={selectedOnly ? "secondary" : "ghost"}
          size="sm"
          className="shrink-0 lg:mt-4 lg:w-full lg:justify-start"
          aria-pressed={selectedOnly}
          onClick={(event) => {
            setSelectedOnly(!selectedOnly);
            event.currentTarget
              .closest('[data-testid="agent-scroll"]')
              ?.scrollTo({ top: 0 });
          }}
        >
          Selected · {selected.length}
        </Button>
      </CategoryNavigation>
      <div className="min-w-0 space-y-7">
        {isLoading && (
          <output className="text-muted-foreground text-sm">
            Loading EVE catalog…
          </output>
        )}
        {error !== undefined && (
          <div
            role="alert"
            className="border-destructive/25 bg-destructive/5 space-y-2 rounded-lg border p-4 text-sm"
          >
            <p>
              EVE’s catalog could not be loaded. Your selections are preserved.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void mutate();
              }}
            >
              Retry catalog
            </Button>
          </div>
        )}
        {selectedOnly && selected.length === 0 && (
          <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
            No capabilities selected yet.
          </p>
        )}
        <div
          data-testid="capability-list"
          className="space-y-7 [&>section]:scroll-mt-20 [&>section]:lg:scroll-mt-6"
        >
          {groups.map((group) => (
            <ConfigurationSection
              key={group.id}
              prefix="agent"
              id={group.id}
              title={group.title}
              icon={<AgentCategoryIcon category={group.id} />}
            >
              {group.id === "skill" && !selectedOnly && (
                <div className="mb-3 space-y-2">
                  <form
                    className="flex gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (skillInput.trim().length >= 2) {
                        setSkillQuery(skillInput.trim());
                      }
                    }}
                  >
                    <Input
                      aria-label="Search skills.sh"
                      placeholder="Search skills.sh…"
                      value={skillInput}
                      onChange={(event) => {
                        setSkillInput(event.target.value);
                      }}
                    />
                    <Button
                      type="submit"
                      variant="outline"
                      disabled={skillInput.trim().length < 2}
                    >
                      Search skills
                    </Button>
                  </form>
                  {skills.isLoading && (
                    <output className="text-muted-foreground block text-xs">
                      Searching skills.sh…
                    </output>
                  )}
                  {skills.error !== undefined && (
                    <p role="alert" className="text-sm">
                      Could not search skills.sh.{" "}
                      <Button
                        variant="link"
                        onClick={() => {
                          void skills.mutate();
                        }}
                      >
                        Retry skills search
                      </Button>
                    </p>
                  )}
                  {skills.data?.length === 0 && (
                    <p className="text-muted-foreground text-xs">
                      No skills found. Try another search.
                    </p>
                  )}
                </div>
              )}
              {group.id === "memory" && (
                <p className="text-muted-foreground mb-3 text-xs">
                  Deleting a chat does not automatically delete provider memory.
                </p>
              )}
              <div className="grid gap-3 md:grid-cols-2">
                {group.items.map((item) => {
                  const issue = eveCompositionIssue(item.id);
                  return (
                    <CapabilityRow
                      key={item.id}
                      title={item.title}
                      visualId={item.id}
                      category={item.category}
                      description={item.description}
                      source={item.source}
                      requiresChatJS={item.requiresChatJS}
                      docs={item.docs}
                      reason={issue}
                      testId={`eve-${item.id}`}
                      controlId={`capability-${item.id}`}
                      controlLabel={`${item.title} (${item.id})`}
                      disabled={
                        issue !== undefined && !selected.includes(item.id)
                      }
                      checked={selected.includes(item.id)}
                      onCheckedChange={(checked) => {
                        toggle(item.id, checked);
                      }}
                    />
                  );
                })}
              </div>
            </ConfigurationSection>
          ))}
        </div>
        <RegistryCapabilityForm />
        {children}
      </div>
    </section>
  );
};
