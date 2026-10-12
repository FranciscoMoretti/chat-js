import { config } from "@/lib/config";
import { writeFile } from "node:fs/promises";

const { appName, appPrefix, appUrl, organization } = config;
const orgEmail =
  organization.contact?.privacyEmail || organization.contact?.legalEmail;

const JSON_INDENTATION_SPACES = 2;
const FAILURE_EXIT_CODE = 1;

const brandingJson = JSON.stringify(
  { appName, appPrefix, appUrl, orgEmail, orgName: organization.name },
  null,
  JSON_INDENTATION_SPACES
);
const writeBranding = async (): Promise<void> => {
  try {
    await writeFile(new URL("../branding.json", import.meta.url), brandingJson);
    console.log("branding.json written:", { appName, appPrefix, appUrl });
  } catch (error) {
    console.error(error);
    process.exitCode = FAILURE_EXIT_CODE;
  }
};
void writeBranding();
