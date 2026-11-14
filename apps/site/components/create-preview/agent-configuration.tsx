"use client";

import { AgentCategoryIcon } from "./agent-category-icon";
import { EveCatalog } from "./eve-catalog";
import {
  resolveInstallationSelection,
  selectToolProvider,
} from "../../../../packages/registry/installation-catalog";
import { Button } from "@/vendor/shadcn-create/styles/base-nova/ui/button";
import {
  Field,
  FieldLabel,
} from "@/vendor/shadcn-create/styles/base-nova/ui/field";
import { FeatureChoices } from "./installation-choices";
import { InvalidInstallation } from "./installation-panel";
import { useInstallation } from "./installation-provider";
import { groupTools } from "./catalog-groups";
import type { ConfigureSetup } from "./setup-guidance";
import { setupActions } from "./setup-guidance";

const selectClassName =
  "border-input bg-background h-9 w-full rounded-md border px-3 text-sm";

export const AgentConfiguration = ({
  onConfigureSetup,
}: {
  readonly onConfigureSetup: ConfigureSetup;
}) => {
  const { catalog, installation, resolution, update } = useInstallation();
  if (!installation || !resolution) {
    return <InvalidInstallation />;
  }
  const tools = catalog.filter((item) => item.definition?.kind === "tool");
  const searchProviders = tools.filter(
    (item) =>
      item.definition?.kind === "tool" && item.definition.slot === "webSearch"
  );
  const searchProvider = searchProviders.find(
    (item) =>
      item.definition !== undefined &&
      resolution.selection.tools.includes(item.definition.id)
  );
  const requiredSearch = resolution.items.some(
    (item) =>
      item.definition?.kind === "tool" &&
      item.definition.requiresTools.includes("webSearch")
  );
  return (
    <div
      className="h-full overflow-y-auto overscroll-contain"
      data-testid="agent-scroll"
    >
      <div className="mx-auto max-w-6xl space-y-8 px-5 py-6 sm:px-8 sm:py-10">
        <h1 className="text-2xl font-semibold tracking-tight">
          Build your agent
        </h1>
        <EveCatalog>
          <section
            id="agent-application"
            aria-label="Application capabilities"
            className="scroll-mt-20 space-y-5 border-t pt-7 lg:scroll-mt-6"
          >
            <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
              <AgentCategoryIcon category="application" />
              Application capabilities
            </h2>
            {groupTools(
              tools.filter(
                (item) =>
                  !searchProviders.includes(item) &&
                  item.definition?.kind === "tool" &&
                  item.definition.native === undefined
              )
            ).map(({ title, items }) => (
              <section key={title} aria-label={title}>
                <h3 className="text-muted-foreground mb-3 text-xs font-medium">
                  {title}
                </h3>
                <FeatureChoices
                  items={items}
                  compact
                  onSelectionChange={(next) => {
                    const needsSearch = resolveInstallationSelection(
                      next,
                      catalog
                    ).items.some(
                      (item) =>
                        item.definition?.kind === "tool" &&
                        item.definition.requiresTools.includes("webSearch")
                    );
                    update(
                      needsSearch
                        ? next
                        : selectToolProvider(
                            next,
                            catalog,
                            "webSearch",
                            // eslint-disable-next-line unicorn/no-useless-undefined -- Required argument; undefined explicitly clears the provider.
                            undefined
                          )
                    );
                  }}
                  onConfigureSetup={onConfigureSetup}
                />
              </section>
            ))}
            {requiredSearch && (
              <Field>
                <FieldLabel htmlFor="agent-search-provider">
                  Research search provider
                </FieldLabel>
                <select
                  id="agent-search-provider"
                  className={selectClassName}
                  value={searchProvider?.definition?.id ?? ""}
                  onChange={(event) => {
                    update(
                      selectToolProvider(
                        installation,
                        catalog,
                        "webSearch",
                        event.target.value || undefined
                      )
                    );
                  }}
                >
                  {searchProviders.map((item) => (
                    <option key={item.name} value={item.definition?.id}>
                      {item.title}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            {setupActions(resolution.issues).map((action) => (
              <Button
                key={action.destination}
                variant="outline"
                onClick={() => {
                  onConfigureSetup(action.destination);
                }}
              >
                {action.label}
              </Button>
            ))}
          </section>
        </EveCatalog>
      </div>
    </div>
  );
};
