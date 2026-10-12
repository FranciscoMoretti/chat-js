import { vi } from "vitest";

import type { Session } from "@/lib/auth";

const fixtureSession: Session = {
  session: {
    createdAt: new Date("2026-09-25T10:00:00Z"),
    expiresAt: new Date("2026-10-25T10:00:00Z"),
    id: "fixture-session",
    token: "local-fixture-token",
    updatedAt: new Date("2026-09-25T10:00:00Z"),
    userId: "fixture-user",
  },
  user: {
    createdAt: new Date("2026-09-25T10:00:00Z"),
    email: "fixture@example.test",
    emailVerified: true,
    id: "fixture-user",
    name: "Fixture member",
    updatedAt: new Date("2026-09-25T10:00:00Z"),
  },
};
const fixtureHeaders = vi
  .fn<() => Promise<Headers>>()
  .mockResolvedValue(new Headers({ "x-fixture-session": "registered" }));
const fixtureAuth = {
  api: {
    getSession: vi
      .fn<
        (input: {
          readonly headers: Readonly<Pick<Headers, "get">>;
        }) => Promise<Session | null>
      >()
      .mockResolvedValue(fixtureSession),
  },
};
const setServerRegistration = (value: "registered" | "missing"): void => {
  fixtureHeaders
    .mockClear()
    .mockResolvedValue(new Headers({ "x-fixture-session": value }));
  fixtureAuth.api.getSession
    .mockClear()
    .mockResolvedValue(value === "registered" ? fixtureSession : null);
};
const getServerCalls = (): readonly string[] =>
  [
    ...fixtureHeaders.mock.invocationCallOrder.map((order) => ({
      order,
      call: "headers",
    })),
    ...fixtureAuth.api.getSession.mock.invocationCallOrder.map(
      (order, index) => ({
        order,
        call: `auth:${fixtureAuth.api.getSession.mock.calls[index][0].headers.get("x-fixture-session")}`,
      })
    ),
  ]
    .toSorted((left, right) => left.order - right.order)
    .map(({ call }) => call);
export { fixtureAuth, fixtureHeaders, getServerCalls, setServerRegistration };
