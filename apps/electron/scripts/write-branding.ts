import { writeFileSync } from "node:fs";

import { config } from "@/lib/config";

const { appName, appPrefix, appUrl, organization } = config;
const orgEmail =
  organization.contact?.privacyEmail || organization.contact?.legalEmail;

writeFileSync(
  new URL("../branding.json", import.meta.url),
  JSON.stringify(
    { appName, appPrefix, appUrl, orgEmail, orgName: organization.name },
    null,
    2
  )
);

console.log("branding.json written:", { appName, appPrefix, appUrl });
