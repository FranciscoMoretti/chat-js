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
let registration: "registered" | "missing" = "registered";
const calls: string[] = [];
const setServerRegistration = (value: "registered" | "missing"): void => {
  registration = value;
  calls.length = 0;
};
const getServerCalls = (): readonly string[] => calls;

const fixtureHeaders =
  /* oxlint-disable eslint/require-await -- The native headers/auth API returns a Promise; this fixture must read and record current registration/header state separately on each invocation. */
  async (): Promise<Headers> => {
    calls.push("headers");
    return new Headers({ "x-fixture-session": registration });
  };
/* oxlint-enable eslint/require-await */
const fixtureAuth = {
  api: {
    getSession:
      /* oxlint-disable eslint/require-await -- The native headers/auth API returns a Promise; this fixture must read and record current registration/header state separately on each invocation. */
      async ({
        headers,
      }: {
        readonly headers: Readonly<Pick<Headers, "get">>;
      }): Promise<Session | null> => {
        calls.push(`auth:${headers.get("x-fixture-session")}`);
        if (registration === "registered") {
          return fixtureSession;
        }
        return null;
      },
    /* oxlint-enable eslint/require-await */
  },
};
export { fixtureAuth, fixtureHeaders, getServerCalls, setServerRegistration };
