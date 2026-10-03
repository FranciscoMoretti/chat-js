/* oxlint-disable import/no-nodejs-modules -- the node:fs import: Electron main/preload and packaging code requires this Node API at the desktop boundary. */
import { writeFileSync } from "node:fs";
/* oxlint-enable import/no-nodejs-modules */

/* oxlint-disable eslint/sort-imports -- the @/lib/config import: Oxfmt groups and sorts by module paths; ordering by imported binding names would conflict with the formatter. */
import { config } from "@/lib/config";
/* oxlint-enable eslint/sort-imports */

const { appName, appPrefix, appUrl, organization } = config;
/* oxlint-disable oxc/no-optional-chaining -- orgEmail: The guarded lookup intentionally permits missing SDK/state fields; preserve one evaluation of the existing optional access. */
const orgEmail =
  organization.contact?.privacyEmail || organization.contact?.legalEmail;
/* oxlint-enable oxc/no-optional-chaining */

/* oxlint-disable node/no-sync -- write-branding.ts: Forge/startup uses synchronous configuration and filesystem contracts before the desktop process is ready. */
/* oxlint-disable unicorn/no-null -- write-branding.ts: The SDK/wire/OS contract uses null as an explicit absence value. */
/* oxlint-disable eslint/no-magic-numbers -- write-branding.ts: Exit/status codes, timeouts and OS/protocol bounds retain this command's operational contract. */
writeFileSync(
  new URL("../branding.json", import.meta.url),
  JSON.stringify(
    { appName, appPrefix, appUrl, orgEmail, orgName: organization.name },
    null,
    2
  )
);
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable unicorn/no-null */
/* oxlint-enable node/no-sync */

/* oxlint-disable eslint/no-console -- branding.json written:: This command or desktop boundary reports startup, progress and failures to its operator. */
console.log("branding.json written:", { appName, appPrefix, appUrl });
/* oxlint-enable eslint/no-console */
