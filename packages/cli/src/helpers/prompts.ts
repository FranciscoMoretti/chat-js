import type { AuthProvider } from "#cli/types";
import { authEnvRequirements } from "./config-requirements";
import { cancel, isCancel, multiselect, select, text } from "@clack/prompts";
import type { Option } from "@clack/prompts";
import { stdin } from "node:process";
import type { Key } from "node:readline";
import { highlighter } from "#cli/utils/highlighter";

import { createCatalog } from "../../../registry/create-catalog";
import {
  authProviderLabels,
  defaultAuthProviders,
} from "../../../registry/installation";

const PROMPT_CANCEL_EXIT_CODE = 1;

const handleCancel: <PromptValue>(
  value: PromptValue
) => asserts value is Exclude<PromptValue, symbol> = (value) => {
  if (isCancel(value)) {
    cancel("Operation cancelled.");
    process.exit(PROMPT_CANCEL_EXIT_CODE);
  }
};

const backHint = highlighter.dim("(Esc to go back)");

const promptWithBack = async <Value>(
  run: () => Promise<Value | symbol>
): Promise<Exclude<Value, symbol> | undefined> => {
  // Clack reports both Esc and Ctrl+C as cancellation. Only Esc goes back.
  let escaped = false;
  const recordKey = (_input: string | undefined, key: Readonly<Key>): void => {
    escaped = key.name === "escape" && key.sequence === "\u001B";
  };
  stdin.prependListener("keypress", recordKey);
  try {
    const value = await run();
    if (escaped && isCancel(value)) {
      return undefined;
    }
    handleCancel(value);
    return value;
  } finally {
    stdin.removeListener("keypress", recordKey);
  }
};

const toKebabCase = (value: string | undefined): string =>
  (value ?? "")
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9-]/gu, "-")
    .replaceAll(/-+/gu, "-")
    .replaceAll(/^-|-$/gu, "");

const promptProjectName = async (
  targetArg: string | undefined,
  skipPrompt: boolean
): Promise<string> => {
  if (skipPrompt) {
    return toKebabCase(targetArg ?? "my-chat-app") || "my-chat-app";
  }

  const name = await text({
    initialValue: targetArg ?? "my-chat-app",
    message: "What is your project named?",
    validate: (value?: string) => {
      const kebab = toKebabCase(value);
      if (!kebab) {
        return "Please enter a valid project name";
      }
      return globalThis.undefined;
    },
  });
  handleCancel(name);

  return toKebabCase(name) || "my-chat-app";
};
const promptAuth = async (
  defaults: readonly AuthProvider[] = defaultAuthProviders,
  allowBack = false
): Promise<AuthProvider[]> => {
  const prompt = async () =>
    await multiselect({
      initialValues: [...defaults],
      message: `Which ${highlighter.info("auth providers")} would you like to enable? ${highlighter.warn("(at least one required)")}${allowBack ? ` ${backHint}` : ""}`,
      options: createCatalog.auth.choices.map((provider) => ({
        hint: authEnvRequirements[provider].description,
        label: authProviderLabels[provider],
        value: provider,
      })),
      required: true,
    });
  const selectedProviders = allowBack
    ? await promptWithBack(prompt)
    : await prompt();
  handleCancel(selectedProviders);
  return selectedProviders ?? [...defaults];
};

export const back = { value: "back", label: "Back" };

const choose = async (
  message: string,
  options: Option<string>[],
  initialValue?: string
): Promise<string> => {
  const run = async () => await select({ message, options, initialValue });
  const backOption = options.find((option) => option.value === back.value);
  if (backOption) {
    return (await promptWithBack(run)) ?? backOption.value;
  }
  const value = await run();
  handleCancel(value);
  return value;
};

const chooseMany = async (
  message: string,
  options: Option<string>[],
  initialValues: string[]
): Promise<string[] | undefined> => {
  if (options.length === 0) {
    return [];
  }
  return await promptWithBack(
    async () =>
      await multiselect({
        message: `${message} ${backHint}`,
        options,
        initialValues,
        required: false,
      })
  );
};

const promptValue = async (
  message: string,
  initialValue?: string,
  validate: (value: string) => string | undefined = (value) =>
    value.trim() ? undefined : "Enter a value."
): Promise<string | undefined> => {
  const value = await promptWithBack(
    async () =>
      await text({
        message: `${message} ${backHint}`,
        initialValue,
        validate: (input) => validate(input ?? ""),
      })
  );
  return value?.trim();
};

export { choose, chooseMany, promptAuth, promptProjectName, promptValue };
