import { writeFile } from "node:fs/promises";

import { config } from "@/lib/config";

const { appName, appPrefix, appUrl, organization } = config;
const orgEmail =
  organization.contact?.privacyEmail || organization.contact?.legalEmail;

const JSON_INDENTATION_SPACES = 2;
const FAILURE_EXIT_CODE = 1;

const brandingJson = JSON.stringify(
  { appName, appPrefix, appUrl, orgEmail, orgName: organization.name },
  // oxlint-disable-next-line unicorn/no-null -- JSON.stringify treats a null replacer as absent; the third argument controls indentation.
  null,
  JSON_INDENTATION_SPACES
);
const writeBranding = async (): Promise<void> => {
  await writeFile(new URL("../branding.json", import.meta.url), brandingJson);
  // oxlint-disable-next-line eslint/no-console -- Preserve its established command-line completion message and argument formatting.
  console.log("branding.json written:", { appName, appPrefix, appUrl });
};

// The generated Node/tsx prebuild runs this file in a CommonJS package, which
// cannot use top-level await. Handle the entry promise and report write failures.
// oxlint-disable-next-line unicorn/prefer-top-level-await, promise/prefer-await-to-then, promise/prefer-await-to-callbacks -- CommonJS requires this handled asynchronous entry point; top-level await fails the Node/tsx prebuild transform.
writeBranding().catch((error: unknown): void => {
  // oxlint-disable-next-line eslint/no-console -- Report failed branding generation to the invoking build command.
  console.error(error);
  process.exitCode = FAILURE_EXIT_CODE;
});
