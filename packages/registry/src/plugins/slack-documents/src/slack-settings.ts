import { z } from "zod";

const slackId = z.string().regex(/^[A-Z][A-Z0-9]+$/u);
const workspace = z.strictObject({
  teamId: slackId,
  channelIds: z.array(slackId).default([]),
  userIds: z.array(slackId).min(1),
  directMessages: z.boolean().default(true),
});
export const slackSettingsSchema = z
  .strictObject({
    workspaces: z.array(workspace).min(1).max(100),
  })
  .superRefine((settings, context) => {
    const teams = new Set<string>();
    for (const row of settings.workspaces) {
      if (teams.has(row.teamId)) {
        context.addIssue({
          code: "custom",
          message: "Slack workspace policies must be unique.",
        });
      }
      teams.add(row.teamId);
    }
  });
export type SlackSettings = z.infer<typeof slackSettingsSchema>;
export type SlackWorkspace = SlackSettings["workspaces"][number];
export const readSlackSettings = (): SlackSettings => {
  const value = process.env.CHATJS_SLACK_DOCUMENTS;
  if (value === undefined || value.trim() === "") {
    throw new Error(
      "Configure CHATJS_SLACK_DOCUMENTS using the Slack setup instructions."
    );
  }
  try {
    return slackSettingsSchema.parse(JSON.parse(value));
  } catch {
    throw new Error(
      "CHATJS_SLACK_DOCUMENTS must contain explicit workspace and user policies."
    );
  }
};
export const configuredSlackWorkspace = (
  teamId: string | undefined
): SlackWorkspace => {
  const result = readSlackSettings().workspaces.find(
    (row) => row.teamId === teamId
  );
  if (result === undefined) {
    throw new Error("Slack workspace is not configured.");
  }
  return result;
};
