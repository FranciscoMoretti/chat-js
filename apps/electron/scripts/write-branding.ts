// oxlint-disable-next-line import/no-nodejs-modules -- The packaging entry point writes branding.json to the generated desktop project.
import { writeFile } from "node:fs/promises";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { config } from "@/lib/config";
/* oxlint-enable sort-imports */

const { appName, appPrefix, appUrl, organization } = config;
const orgEmail =
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading privacyEmail from organization.contact; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. Keep the existing nullish guard when reading legalEmail from organization.contact; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
  organization.contact?.privacyEmail || organization.contact?.legalEmail;

const JSON_INDENTATION_SPACES = 2;
const FAILURE_EXIT_CODE = 1;

const brandingJson = JSON.stringify(
  { appName, appPrefix, appUrl, orgEmail, orgName: organization.name },
  // oxlint-disable-next-line unicorn/no-null -- JSON.stringify treats a null replacer as absent; the third argument controls indentation.
  null,
  JSON_INDENTATION_SPACES
);
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve writeBranding's awaited sequencing and rejected-Promise behavior. */
const writeBranding = async (): Promise<void> => {
  await writeFile(new URL("../branding.json", import.meta.url), brandingJson);
  // oxlint-disable-next-line eslint/no-console -- Preserve its established command-line completion message and argument formatting.
  console.log("branding.json written:", { appName, appPrefix, appUrl });
};
/* oxlint-enable oxc/no-async-await */
// The generated Node/tsx prebuild runs this file in a CommonJS package, which
// cannot use top-level await. Handle the entry promise and report write failures.
// oxlint-disable-next-line unicorn/prefer-top-level-await, promise/prefer-await-to-then, promise/prefer-await-to-callbacks -- CommonJS requires this handled asynchronous entry point; top-level await fails the Node/tsx prebuild transform.
writeBranding().catch((error: unknown): void => {
  // oxlint-disable-next-line eslint/no-console -- Report failed branding generation to the invoking build command.
  console.error(error);
  process.exitCode = FAILURE_EXIT_CODE;
});
