#!/usr/bin/env node
import { Command } from "commander";
import packageJson from "../package.json";
import { add } from "./commands/add";
import { config } from "./commands/config";
import { create } from "./commands/create";

process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));

const program = new Command()
  .name("chat-js")
  .description("ChatJS CLI")
  .version(packageJson.version, "-v, --version", "display the version number");

program.addCommand(create, { isDefault: true });
program.addCommand(add);
program.addCommand(config);

program.parse();
