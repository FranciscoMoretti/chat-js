import { writeFileSync } from "node:fs";

import { config } from "@/lib/config";

const { appName, appPrefix, appUrl, organization } = config;
const orgEmail =
  organization.contact?.privacyEmail || organization.contact?.legalEmail;

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
