#!/usr/bin/env node
import { Command } from "commander";

/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import packageJson from "../package.json";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { add } from "./commands/add";
/* oxlint-enable sort-imports */
import { config } from "./commands/config";
import { create } from "./commands/create";
import { sync } from "./commands/sync";

const SUCCESS_EXIT_CODE = 0;

process.on("SIGINT", () => process.exit(SUCCESS_EXIT_CODE));
process.on("SIGTERM", () => process.exit(SUCCESS_EXIT_CODE));

const program = new Command()
  .name("chat-js")
  .description("ChatJS CLI")
  .version(packageJson.version, "-v, --version", "display the version number");

program.addCommand(create, { isDefault: true });
program.addCommand(add);
program.addCommand(sync);
program.addCommand(config);

program.parse();
