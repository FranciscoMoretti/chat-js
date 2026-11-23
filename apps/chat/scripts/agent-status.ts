#!/usr/bin/env bun
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { getMissingRequirement } from "../lib/config-requirements";
import { validatePluginEnvironment } from "./installed-environment-validation";
import { config as loadEnv } from "dotenv";
import { toolRequirements } from "../chatjs/generated/tool-requirements";
import { missingToolConfiguration } from "../lib/eve/tool-configuration";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });

const tools = Object.entries(toolRequirements).map(([name, definition]) => {
  const missing = missingToolConfiguration(name);
  return {
    name,
    capability: definition.id,
    installation: "installed",
    configuration: missing.length > 0 ? "incomplete" : "present",
    connection: "not-checked",
    verification: "not-run",
    missing,
  };
});
const descriptor = z.object({
  id: z.string(),
  envRequirements: z
    .array(
      z.object({
        options: z.array(z.array(z.string())),
        runtimeAuth: z.literal("vercel-oidc").optional(),
      })
    )
    .default([]),
  files: z.array(z.string()).default([]),
});
const directory = path.resolve(import.meta.dirname, "../chatjs/plugins");
const entries = await readdir(directory, { withFileTypes: true });
const pluginGroups = await Promise.all(
  entries.map(async (entry) => {
    if (!entry.isDirectory() || entry.name.startsWith("_")) {
      return [];
    }
    const itemDirectory = path.join(directory, entry.name);
    const source = await readFile(
      path.join(itemDirectory, "plugin.json"),
      "utf-8"
    ).catch((error: unknown) => {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return null;
      }
      throw error;
    });
    if (source === null) {
      return [];
    }
    const definition = descriptor.parse(JSON.parse(source));
    const missing = definition.envRequirements.flatMap((requirement) => {
      const result = getMissingRequirement(requirement, process.env);
      return result === null ? [] : [result];
    });
    if (missing.length === 0) {
      missing.push(
        ...(await validatePluginEnvironment(
          itemDirectory,
          definition.files,
          process.env
        ))
      );
    }
    return [
      {
        name: definition.id,
        installation: "installed",
        configuration: missing.length > 0 ? "incomplete" : "present",
        connection: "not-checked",
        verification: "not-run",
        missing,
      },
    ];
  })
);
const plugins = pluginGroups.flat();
if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ tools, plugins }, null, 2));
} else {
  console.log(
    "Agent setup — configuration presence only; no live checks have run."
  );
  for (const tool of [...tools, ...plugins]) {
    console.log(
      `${tool.name}: installed; configuration ${tool.configuration}; connection ${tool.connection}; verification ${tool.verification}`
    );
    for (const requirement of tool.missing) {
      console.log(`  Configure ${requirement} in .env.local.`);
    }
  }
  console.log(
    "After configuring missing values, rerun chat-js setup. Run bun check-env for full application validation. Verify connections and execution separately."
  );
}
process.exitCode = [...tools, ...plugins].some(
  (tool) => tool.configuration === "incomplete"
)
  ? 1
  : 0;
