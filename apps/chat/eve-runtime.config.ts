// Signed-in-only profile for the isolated free Render acceptance deployment.
export const guestEnabled = false;
export const eveAgents: Record<string, string> = guestEnabled
  ? { chat: ".", guest: "./guest" }
  : { chat: "." };
