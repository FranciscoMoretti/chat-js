#!/usr/bin/env node
import { Command } from "commander";
import { add } from "./commands/add";
import { config } from "./commands/config";
import { create } from "./commands/create";
import packageJson from "../package.json";
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
