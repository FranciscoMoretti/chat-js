// Both isolated agents participate in the free Render memory acceptance trial.
export const guestEnabled = true;
export const eveAgents: Record<string, string> = guestEnabled
  ? { chat: ".", guest: "./guest" }
  : { chat: "." };
