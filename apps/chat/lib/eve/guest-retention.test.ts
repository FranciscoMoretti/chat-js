import { expect, test } from "vitest";
import { guestTracePolicy } from "@/chatjs/plugins/guest-chat/guest-retention";

test.each(["development", "preview", "production"] as const)(
  "guests omit payload capture to request native retention zero in %s",
  (environment) => {
    expect(
      guestTracePolicy({
        agentName: "chat",
        channel: { kind: "channel:eve" },
        audience: "unknown",
        environment,
        principalType: "guest",
      })
    ).toEqual({ emit: true, recordInputs: false, recordOutputs: false });
  }
);

test.each(["user", "service", "runtime"])(
  "%s retains EVE's default trace and retention decision",
  (principalType) => {
    expect(
      guestTracePolicy({
        agentName: "chat",
        channel: { kind: "channel:eve" },
        audience: "private",
        environment: "production",
        principalType,
      })
    ).toBe(true);
  }
);
