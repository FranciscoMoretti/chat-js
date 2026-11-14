import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { registryItemSchema } from "shadcn/schema";
import type { RegistryItem } from "shadcn/schema";
import { z } from "zod";
import { installItems } from "./shadcn";

export const resolvedItemSchema = z.strictObject({
  source: z.string().min(1),
  sha256: z.string().regex(/^[a-f0-9]{64}$/u),
  item: registryItemSchema,
});
export type ResolvedItem = z.infer<typeof resolvedItemSchema>;

const digest = (item: RegistryItem): string =>
  createHash("sha256").update(JSON.stringify(item)).digest("hex");

export const resolveItemPayload = (
  source: string,
  input: RegistryItem
): ResolvedItem => {
  const item = registryItemSchema.parse(input);
  return { source, item, sha256: digest(item) };
};

export const validateResolvedItems = (input: unknown): ResolvedItem[] => {
  const items = z.array(resolvedItemSchema).parse(input);
  const sources = new Set(items.map(({ source }) => source));
  if (sources.size !== items.length) {
    throw new Error("Resolved capabilities contain duplicate sources.");
  }
  for (const entry of items) {
    if (digest(entry.item) !== entry.sha256) {
      throw new Error(
        `Resolved capability changed: ${entry.source}. Resolve a new recipe explicitly.`
      );
    }
    for (const file of entry.item.files ?? []) {
      if (file.content === undefined) {
        throw new Error(
          `Resolved capability ${entry.source} lacks source content for ${file.path}.`
        );
      }
    }
    for (const dependency of entry.item.registryDependencies ?? []) {
      if (!sources.has(dependency)) {
        throw new Error(
          `Resolved capability ${entry.source} is missing dependency ${dependency}. No newer revision will be substituted.`
        );
      }
    }
  }
  return items;
};

/** Install the reviewed graph through shadcn without fetching its sources again. */
export const installResolvedItems = async (
  input: unknown,
  cwd: string,
  overwrite: boolean
): Promise<void> => {
  const items = validateResolvedItems(input);
  if (items.length === 0) {
    return;
  }
  const directory = await mkdtemp(path.join(tmpdir(), "chatjs-resolved-"));
  try {
    const destinations = new Map(
      items.map(({ source }, index) => [
        source,
        path.join(directory, `${index}.json`),
      ])
    );
    await Promise.all(
      items.map(async ({ source, item }) => {
        const destination = destinations.get(source);
        if (destination === undefined) {
          throw new Error(`Missing resolved destination for ${source}.`);
        }
        await writeFile(
          destination,
          JSON.stringify({
            ...item,
            registryDependencies: item.registryDependencies?.map((dependency) =>
              destinations.get(dependency)
            ),
          })
        );
      })
    );
    await installItems([...destinations.values()], cwd, overwrite);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
};
