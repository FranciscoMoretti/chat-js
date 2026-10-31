import { config } from "../../chat/lib/config";
import {
  ELECTRON_AUTH_CALLBACK_PATH,
  ELECTRON_AUTH_CLIENT_ID,
  ELECTRON_AUTH_COOKIE_PREFIX,
} from "../../chat/plugins/desktop/protocol";
import { writeFile } from "node:fs/promises";

const { appName, appPrefix, appUrl, organization } = config;
const orgEmail =
  organization.contact?.privacyEmail || organization.contact?.legalEmail;

const JSON_INDENTATION_SPACES = 2;
const FAILURE_EXIT_CODE = 1;

const brandingJson = JSON.stringify(
  {
    appName,
    appPrefix,
    appUrl,
    orgEmail,
    orgName: organization.name,
    auth: {
      callbackPath: ELECTRON_AUTH_CALLBACK_PATH,
      clientId: ELECTRON_AUTH_CLIENT_ID,
      cookiePrefix: ELECTRON_AUTH_COOKIE_PREFIX,
    },
  },
  null,
  JSON_INDENTATION_SPACES
);
const writeBranding = async (): Promise<void> => {
  try {
    await writeFile(
      new URL("../branding.json", import.meta.url),
      `${brandingJson}\n`
    );
    console.log("branding.json written:", { appName, appPrefix, appUrl });
  } catch (error) {
    console.error(error);
    process.exitCode = FAILURE_EXIT_CODE;
  }
};
void writeBranding();
