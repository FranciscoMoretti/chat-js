import { writeFile } from "node:fs/promises";

import { config } from "@/lib/config";

const { appName, appPrefix, appUrl, organization } = config;
const orgEmail =
  organization.contact?.privacyEmail || organization.contact?.legalEmail;

const JSON_INDENTATION_SPACES = 2;

const brandingJson = JSON.stringify(
  { appName, appPrefix, appUrl, orgEmail, orgName: organization.name },
  // oxlint-disable-next-line unicorn/no-null -- JSON.stringify treats a null replacer as absent; the third argument controls indentation.
  null,
  JSON_INDENTATION_SPACES
);
await writeFile(new URL("../branding.json", import.meta.url), brandingJson);

// This prebuild command reports its generated artifact to the invoking operator.
// oxlint-disable-next-line eslint/no-console -- Preserve its established command-line completion message and argument formatting.
console.log("branding.json written:", { appName, appPrefix, appUrl });
