import { defaultAgentConfiguration } from "../agent-configuration";
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

test("provider item aliases resolve to canonical IDs without changing the request", () => {
  const input = {
    ...minimal,
    gateway: "@chatjs/vercel-gateway",
    storage: { source: "vercel-blob-storage", options: {} },
    sandbox: "vercel-sandbox",
  };
  const result = resolveInstallationSelection(input, catalog);

  expect(result.requested).toEqual(input);
  expect(result.selection).toEqual({ ...minimal, sandbox: "vercel" });
  expect(result.issues).toEqual([]);
});

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
    sandbox: "docker",
    storage: { source: "memory", options: {} },
  };
  const result = resolveInstallationSelection(requested, catalog);
  expect(result.issues.join(", ")).not.toContain("persistent sandbox");
  expect(result.issues.join(", ")).toContain("persistent storage");
  expect(result.selection.sandbox).toBe("docker");
  expect(
    resolveInstallationSelection(
      { ...minimal, sandbox: "just-bash", tools: ["code-execution"] },
      catalog
    ).issues.join(", ")
  ).toContain("requires native Python");
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

test("native default tools do not require a ChatJS sandbox provider", () => {
  const missing = resolveInstallationSelection(
    { ...minimal, agent: { ...defaultAgentConfiguration, defaultTools: true } },
    catalog
  );
  expect(missing.issues).toEqual([]);
  const enabled = resolveInstallationSelection(
    {
      ...minimal,
      agent: { ...defaultAgentConfiguration, defaultTools: true },
      sandbox: "vercel",
    },
    catalog
  );
  expect(enabled.issues).toEqual([]);
});

test("Slack can use native sandbox tools", () => {
  const result = resolveInstallationSelection(
    {
      ...minimal,
      eve: ["channel/slack"],
      sandbox: "vercel",
      agent: { ...defaultAgentConfiguration, defaultTools: true },
    },
    catalog
  );
  expect(result.issues).toEqual([]);
});

test("native portable tools need no application services and cannot duplicate an application provider", () => {
  const portable = resolveInstallationSelection(
    { ...minimal, eve: ["@chatjs/word-count"] },
    catalog
  );
  expect(portable.issues).toEqual([]);
  expect(portable.selection.tools).toEqual([]);
  expect(portable.selection.plugins).toEqual([]);
  const duplicate = resolveInstallationSelection(
    { ...minimal, eve: ["@chatjs/word-count"], tools: ["word-count"] },
    catalog
  );
  expect(duplicate.issues).toContain(
    "word-count is selected through EVE and through application features. Choose one installation for this capability."
  );
  const providers = resolveInstallationSelection(
    { ...minimal, eve: ["@chatjs/tavily-search", "@chatjs/firecrawl-search"] },
    catalog
  );
  expect(providers.issues).toContain(
    "Select only one native provider for webSearch."
  );
});
