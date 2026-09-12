import { writeFileSync } from "node:fs";
import path from "node:path";

import { config } from "@/lib/config";

const { appName, appPrefix, appUrl, organization } = config;
const orgEmail =
  organization.contact?.privacyEmail || organization.contact?.legalEmail;

writeFileSync(
  path.resolve(__dirname, "..", "branding.json"),
  JSON.stringify(
    { appName, appPrefix, appUrl, orgEmail, orgName: organization.name },
    null,
    2
  )
);

console.log("branding.json written:", { appName, appPrefix, appUrl });
