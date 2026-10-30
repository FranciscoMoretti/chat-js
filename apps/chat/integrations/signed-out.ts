import { installedSignedOutScreens } from "@/chatjs/generated/installed-signed-out";
import { selectIntegration } from "@/lib/select-integration";

export const SignedOutScreen = selectIntegration(
  "signed-out screen",
  installedSignedOutScreens
);
