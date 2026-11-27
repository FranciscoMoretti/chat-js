import type { CreateFieldKey } from "../../../registry/create-catalog";
import { Command } from "commander";
import { z } from "zod";
import {
  addFlagKeys,
  removeFlagKeys,
  createCatalog,
  createFieldKeys,
  createFlag,
} from "../../../registry/create-catalog";

type Fields = typeof createCatalog;
export type CreateSelectionFlags = {
  readonly [K in keyof Fields]?: z.output<Fields[K]["schema"]>;
};

export type AddSelectionFlags = Pick<
  CreateSelectionFlags,
  (typeof addFlagKeys)[number]
>;

// Absent flags must never override an installed provider or a create preset.
const parseSelectionFlags = (
  options: Readonly<Record<string, unknown>>,
  keys: readonly CreateFieldKey[]
): CreateSelectionFlags => {
  const parsed = Object.fromEntries(
    keys.flatMap((key) => {
      if (options[key] === undefined) {
        return [];
      }
      const result = createCatalog[key].schema.safeParse(options[key]);
      if (!result.success) {
        throw new Error(`${createFlag(key)}\n${z.prettifyError(result.error)}`);
      }
      return [[key, result.data]];
    })
  );
  return parsed;
};

export const parseCreateFlags = (options: Readonly<Record<string, unknown>>) =>
  parseSelectionFlags(options, createFieldKeys);
export const parseAddFlags = (
  options: Readonly<Record<string, unknown>>
): AddSelectionFlags => parseSelectionFlags(options, addFlagKeys);

const selectionKeys = {
  create: createFieldKeys,
  add: addFlagKeys,
  remove: removeFlagKeys,
};
export const selectionCommand = (name: keyof typeof selectionKeys): Command => {
  const command = new Command(name);
  for (const key of selectionKeys[name]) {
    const field = createCatalog[key];
    const flag = createFlag(key);
    const description = "help" in field ? field.help : field.description;
    const help = name === "remove" ? createCatalog.plugin.remove : description;
    if (field.kind === "toggle") {
      command.option(flag, help);
      command.option(`--no-${flag.slice(2)}`, `Omit ${field.label}.`);
    } else if (field.kind === "multiple") {
      command.option(
        `${flag} <${name === "remove" ? "id" : "item"}>`,
        `${help}${"choices" in field && Array.isArray(field.choices) ? ` Choices: ${field.choices.join(", ")}.` : ""} Repeat for multiple items.`,
        (value, previous: string[] | undefined) => [...(previous ?? []), value]
      );
    } else {
      command.option(
        `${flag} <${field.kind === "json" ? "json" : "item"}>`,
        help
      );
    }
  }
  return command;
};
