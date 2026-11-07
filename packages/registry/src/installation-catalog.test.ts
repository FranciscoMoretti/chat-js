import { expect, test } from "bun:test";
import {
  installationCatalog,
  resolveInstallationSelection,
} from "../installation-catalog";
import { registryItems } from "../registry-items";
import { storageItems } from "./storage/items";
import { registry } from "../registry";

const catalog = installationCatalog([...registryItems, ...storageItems]);
const minimal = {
  gateway: "vercel",
  plugins: [],
  tools: [],
  storage: { source: "vercel-blob", options: {} },
};

test("the web catalog and packaged registry describe exactly the same choices", () => {
  const sorted = (items: typeof catalog) =>
    items.toSorted((a, b) => a.name.localeCompare(b.name));
  expect(sorted(catalog)).toEqual(sorted(installationCatalog(registry.items)));
});

test("empty choices stay empty; backend plugins do not require preview implementations", () => {
  expect(resolveInstallationSelection(minimal, catalog).selection).toEqual(
    minimal
  );
  for (const item of catalog.filter(
    (candidate) => candidate.definition?.kind === "plugin"
  )) {
    const result = resolveInstallationSelection(
      { ...minimal, sandbox: "vercel", plugins: [item.name] },
      catalog
    );
    expect(result.issues).toEqual([]);
    expect(result.selection.plugins).toContain(item.name);
  }
});

test("transitive dependencies are inferred without becoming user selections", () => {
  const requested = { ...minimal, tools: ["deep-research"] };
  const result = resolveInstallationSelection(requested, catalog);
  expect(result.issues).toEqual([]);
  expect(result.selection.tools.toSorted()).toEqual([
    "deep-research",
    "read-document",
    "tavily-search",
    "text-documents",
  ]);
  expect(result.requested.tools).toEqual(["deep-research"]);
  expect(result.reasons["text-documents"]).toEqual(["Deep Research"]);
  expect(requested.tools).toEqual(["deep-research"]);
  expect(
    resolveInstallationSelection({ ...requested, tools: [] }, catalog).selection
      .tools
  ).toEqual([]);
  expect(
    resolveInstallationSelection(
      { ...requested, tools: ["text-documents"] },
      catalog
    ).selection.tools.toSorted()
  ).toEqual(["read-document", "text-documents"]);
});

test("explicit providers satisfy slots without silently installing their defaults", () => {
  const result = resolveInstallationSelection(
    { ...minimal, tools: ["deep-research", "firecrawl-search"] },
    catalog
  );
  expect(result.issues).toEqual([]);
  expect(result.selection.tools).not.toContain("tavily-search");
  expect(
    resolveInstallationSelection(
      { ...minimal, tools: ["tavily-search", "firecrawl-search"] },
      catalog
    ).issues.join(", ")
  ).toContain("Choose only one webSearch");
});

test("provider requirements block invalid installs without changing user choices", () => {
  const requested = {
    ...minimal,
    plugins: ["attachment-uploads"],
    sandbox: "daytona",
    storage: { source: "memory", options: {} },
  };
  const result = resolveInstallationSelection(requested, catalog);
  expect(result.issues.join(", ")).toContain("persistent sandbox");
  expect(result.issues.join(", ")).toContain("persistent storage");
  expect(result.selection.sandbox).toBe("daytona");
  expect(
    resolveInstallationSelection(
      { ...minimal, tools: ["code-execution"] },
      catalog
    ).issues.join(", ")
  ).toContain("requires a sandbox");
  expect(
    resolveInstallationSelection(
      { ...minimal, gateway: "openrouter", tools: ["generate-video"] },
      catalog
    ).issues.join(", ")
  ).toContain("video generation");
});

test("unknown entries and private storage options fail closed", () => {
  expect(
    resolveInstallationSelection(
      { ...minimal, plugins: ["unknown"] },
      catalog
    ).issues.join(", ")
  ).toContain("Unknown plugin");
  expect(
    resolveInstallationSelection(
      {
        ...minimal,
        storage: {
          source: "s3",
          options: { secretAccessKey: "not-a-real-key" },
        },
      },
      catalog
    ).issues.join(", ")
  ).toContain("environment variables");
});
