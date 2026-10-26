import type { Command } from "commander";

const FIRST_ARGUMENT = 0;
const NEXT_ARGUMENT = 1;
const MAX_DIRECTORY_ARGUMENTS = 1;

// ChatJS owns project topology and initialization lifecycle. This is deliberately
// a denylist, not a second parser/catalog for native shadcn visual options.
const reservedLongOptions = new Set([
  "--cwd",
  "--name",
  "--template",
  "--monorepo",
  "--no-monorepo",
  "--force",
  "--reinstall",
  "--no-reinstall",
  "--defaults",
  "--help",
  "--version",
]);
const reservedShortOptions = /^-[ys]*[cntfdhV]/u;

export const createShadcnArguments = (
  command: Readonly<Command>
): { target: string | undefined; shadcnArgs: string[] } => {
  let argumentOwner = command;
  while (argumentOwner.parent) {
    argumentOwner = argumentOwner.parent;
  }
  const rawArgs: unknown = Reflect.get(argumentOwner, "rawArgs");
  if (
    !(
      Array.isArray(rawArgs) &&
      rawArgs.every((arg): arg is string => typeof arg === "string")
    )
  ) {
    throw new Error("Could not read the original create arguments.");
  }
  const boundary = rawArgs.indexOf("--");
  const shadcnArgs =
    boundary < FIRST_ARGUMENT ? [] : rawArgs.slice(boundary + NEXT_ARGUMENT);
  const directories = command.args.slice(
    FIRST_ARGUMENT,
    command.args.length - shadcnArgs.length
  );
  if (directories.length > MAX_DIRECTORY_ARGUMENTS) {
    throw new Error(
      "create accepts one directory. Put native shadcn options after --."
    );
  }
  return { target: directories[FIRST_ARGUMENT], shadcnArgs };
};

export const assertCreateShadcnReady = (
  args: readonly string[],
  fromGit?: string
): void => {
  if (args.length === FIRST_ARGUMENT) {
    return;
  }
  if (typeof fromGit === "string" && fromGit !== "") {
    throw new Error(
      "--from-git preserves the cloned application and cannot accept shadcn initialization options. Run native shadcn commands in the cloned app explicitly."
    );
  }
  for (const argument of args) {
    const option = argument.split("=")[FIRST_ARGUMENT];
    const shortOption = argument.startsWith("-") && !argument.startsWith("--");
    if (
      reservedLongOptions.has(option) ||
      (shortOption && reservedShortOptions.test(argument))
    ) {
      throw new Error(
        `${option} cannot be forwarded: ChatJS owns the target directory, scaffold, and initialization lifecycle.`
      );
    }
  }
  let base: string | undefined;
  for (const [index, argument] of args.entries()) {
    if (argument === "--base" || argument === "-b") {
      base = args[index + NEXT_ARGUMENT];
    } else if (argument.startsWith("--base=")) {
      base = argument.slice("--base=".length);
    } else if (/^-[ys]*b.+/u.test(argument)) {
      base = argument.replace(/^-[ys]*b/u, "");
    }
  }
  if (base !== undefined && base !== "base" && base !== "radix") {
    throw new Error(
      `ChatJS supports Base UI and Radix (--base base or --base radix), not --base ${base}. No project has been created.`
    );
  }
};
