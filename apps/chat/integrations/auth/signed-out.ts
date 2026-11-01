import { installedSignedOutScreens } from "@/chatjs/generated/installed-signed-out";
import { selectIntegration } from "@/chatjs/core/installation/select";

export const SignedOutScreen = selectIntegration(
  "signed-out screen",
  installedSignedOutScreens
);
