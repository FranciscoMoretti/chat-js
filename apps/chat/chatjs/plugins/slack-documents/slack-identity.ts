import type { DynamicModelContext } from "eve";
import { z } from "zod";
import { configuredSlackWorkspace } from "./slack-settings";

const actorSchema = z.object({
  authenticator: z.literal("slack-webhook"),
  principalType: z.literal("user"),
  principalId: z.string(),
  issuer: z.string(),
  attributes: z.object({
    user_id: z.string().min(1),
    channel_id: z.string().min(1),
    thread_ts: z.string().min(1),
  }),
});
export type SlackSession = Pick<
  DynamicModelContext["session"],
  "id" | "auth" | "parent"
>;
export const slackActor = (session: SlackSession) => {
  const current = actorSchema.parse(session.auth.current);
  const initiator = actorSchema.parse(session.auth.initiator);
  const { attributes } = current;
  const teamId = current.issuer.startsWith("slack:")
    ? current.issuer.slice(6)
    : undefined;
  const direct = attributes.channel_id.startsWith("D");
  const workspace = configuredSlackWorkspace(teamId);
  if (
    current.issuer !== `slack:${teamId}` ||
    current.principalId !== `slack:${teamId}:${attributes.user_id}` ||
    initiator.issuer !== `slack:${teamId}` ||
    initiator.principalId !==
      `slack:${teamId}:${initiator.attributes.user_id}` ||
    initiator.attributes.channel_id !== attributes.channel_id ||
    initiator.attributes.thread_ts !== attributes.thread_ts ||
    !workspace.userIds.includes(attributes.user_id) ||
    (direct
      ? !workspace.directMessages
      : !workspace.channelIds.includes(attributes.channel_id))
  ) {
    throw new Error(
      "Slack caller is not authorized for this workspace and conversation."
    );
  }
  return {
    teamId: workspace.teamId,
    channelId: attributes.channel_id,
    threadTs: attributes.thread_ts,
    actorId: current.principalId,
    userId: attributes.user_id,
    direct,
    workspace,
  };
};
