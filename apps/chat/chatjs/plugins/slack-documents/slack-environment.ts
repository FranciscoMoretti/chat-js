import { slackSettingsSchema } from "./slack-settings";

export const validateEnvironment = (
  env: Readonly<NodeJS.ProcessEnv>
): string[] => {
  try {
    slackSettingsSchema.parse(JSON.parse(env.CHATJS_SLACK_DOCUMENTS ?? ""));
    return [];
  } catch {
    return [
      "CHATJS_SLACK_DOCUMENTS must specify unique workspace policies and allowed users. See chatjs/plugins/slack-documents/SETUP.md.",
    ];
  }
};
