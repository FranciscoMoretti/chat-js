import { isAccountSession } from "../../lib/eve/session-identity";
import { defineDynamic, defineInstructions } from "eve/instructions";
import { systemPrompt } from "../../lib/ai/prompts";

export default defineDynamic(async (context) => {
  if (isAccountSession(context.session)) {
    return defineInstructions({ content: systemPrompt() });
  }
  if (
    context.session.auth.initiator?.authenticator?.startsWith("chatjs-") !==
    true
  ) {
    return null;
  }
  const { findSessionProfile } = await import("../../lib/eve/session-profile");
  const content = findSessionProfile(context.session)?.instructions;
  return content === undefined ? null : defineInstructions({ content });
});
