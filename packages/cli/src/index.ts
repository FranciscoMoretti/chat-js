#!/usr/bin/env node
import { Command } from "commander";

/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import packageJson from "../package.json";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { add } from "./commands/add";
/* oxlint-enable eslint/sort-imports */
import { config } from "./commands/config";
import { create } from "./commands/create";
import { sync } from "./commands/sync";

/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
process.on("SIGINT", () => process.exit(0));
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
process.on("SIGTERM", () => process.exit(0));
/* oxlint-enable eslint/no-magic-numbers */

const program = new Command()
  .name("chat-js")
  .description("ChatJS CLI")
  .version(packageJson.version, "-v, --version", "display the version number");

program.addCommand(create, { isDefault: true });
program.addCommand(add);
program.addCommand(sync);
program.addCommand(config);

program.parse();
