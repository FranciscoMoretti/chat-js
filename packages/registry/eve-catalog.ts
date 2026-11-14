import { z } from "zod";

export const eveRegistryUrl = "https://eve.dev/r/registry.json";
const nativeId = /^[a-z][a-z0-9_-]*\/[a-z][a-z0-9_/-]*$/u;
const registryId = /^@[a-z][a-z0-9-]*\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_.-]+)*$/u;
export const registryTemplateSchema = z.string().refine((value) => {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.username === "" &&
      url.password === "" &&
      value.includes("{name}")
    );
  } catch {
    return false;
  }
}, "Use a public HTTPS registry template containing {name}.");
export const eveRegistriesSchema = z.record(
  z.string().regex(/^@(?!skills$|chatjs$)[a-z][a-z0-9-]*$/u),
  registryTemplateSchema
);
export const eveItemIdSchema = z
  .string()
  .max(2000)
  .refine((value) => {
    if (nativeId.test(value) || registryId.test(value)) {
      return !value
        .split("/")
        .some((part) => part === "." || part === ".." || part === "");
    }
    try {
      const url = new URL(value);
      return (
        url.protocol === "https:" && url.username === "" && url.password === ""
      );
    } catch {
      return false;
    }
  }, "Enter an EVE item, @skills address, named registry item, or public HTTPS item URL.");
export const capabilitySource = (id: string): string => {
  if (id.startsWith("@skills/")) {
    return "skills.sh";
  }
  if (id.startsWith("@chatjs/")) {
    return "ChatJS";
  }
  if (id.startsWith("@")) {
    return id.split("/")[0];
  }
  if (id.startsWith("https://")) {
    return new URL(id).hostname;
  }
  return "EVE catalog";
};
export const eveCategories = {
  tool: "Tools",
  connection: "Connections",
  channel: "Channels",
  skill: "Skills",
  extension: "Extensions",
  memory: "Memory",
  instrumentation: "Observability",
} as const;

const catalogSchema = z.object({
  items: z.array(
    z.object({
      name: eveItemIdSchema,
      title: z.string().optional(),
      description: z.string().optional(),
      envVars: z.record(z.string(), z.unknown()).optional(),
      meta: z
        .object({
          eve: z
            .object({
              hidden: z.boolean().optional(),
              docs: z.string().optional(),
              requires: z.string().optional(),
              setup: z.unknown().optional(),
            })
            .optional(),
        })
        .optional(),
    })
  ),
});

/** The only application-specific exception: these install a second frontend. */
export const eveCompositionIssue = (id: string): string | undefined =>
  id === "channel/web" || id === "channel/web-tanstack"
    ? "ChatJS already provides web chat. This item installs a separate frontend and requires manual composition."
    : undefined;

export const parseEveCatalog = (input: unknown) =>
  catalogSchema
    .parse(input)
    .items.filter((item) => item.meta?.eve?.hidden !== true)
    .map((item) => ({
      id: item.name,
      title: item.title ?? item.name.split("/").slice(1).join("/"),
      description: item.description ?? "",
      source: "EVE catalog",
      requiresChatJS: false,
      category: item.name.split("/")[0],
      requires: item.meta?.eve?.requires,
      setup: item.meta?.eve?.setup !== undefined,
      environment: Object.keys(item.envVars ?? {}),
      docs: new URL(
        item.meta?.eve?.docs?.startsWith("/docs/") === true
          ? item.meta.eve.docs
          : "/docs/install-integrations",
        "https://eve.dev"
      ).href,
    }));
export type EveCatalogItem = z.infer<typeof eveCatalogItemsSchema>[number];

export const eveCatalogItemsSchema = z.array(
  z.object({
    id: eveItemIdSchema,
    title: z.string(),
    description: z.string(),
    category: z.string(),
    source: z.string(),
    requiresChatJS: z.boolean().optional(),
    requires: z.string().optional(),
    setup: z.boolean(),
    environment: z.array(z.string()),
    docs: z.url(),
  })
);

/** Native registry responses need no ChatJS-specific capability manifest. */
export const parseSkillsCatalog = (input: unknown): EveCatalogItem[] => {
  const registry = z
    .object({
      items: z.array(
        z.object({
          name: z.string().regex(/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_.-]+){2,}$/u),
          title: z.string().optional(),
          description: z.string().optional(),
        })
      ),
    })
    .parse(input);
  return registry.items.map((item) => ({
    id: eveItemIdSchema.parse(`@skills/${item.name}`),
    title: item.title ?? item.name,
    description: item.description ?? "",
    category: "skill",
    source: "skills.sh",
    requiresChatJS: false,
    setup: false,
    environment: [],
    docs: `https://skills.sh/${item.name}`,
  }));
};

export const selectedCapability = (id: string): EveCatalogItem => ({
  id,
  title: id,
  description:
    "Selected registry item. EVE resolves its metadata and installs its native files during generation.",
  category: id.startsWith("@skills/") ? "skill" : "other",
  source: capabilitySource(id),
  setup: false,
  environment: [],
  docs: "https://eve.dev/docs/install-integrations",
});
