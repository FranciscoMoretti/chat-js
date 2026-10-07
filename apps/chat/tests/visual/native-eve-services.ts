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
/* oxlint-disable oxc/no-async-await -- Keep the actual asynchronous Next header and Better Auth session signatures while returning fixed local service responses. */
// oxlint-disable-next-line eslint/require-await, typescript/require-await -- React act and native asynchronous auth/header APIs expose completion promises even when the fixture operation is synchronous.
const fixtureHeaders = async (): Promise<Headers> => {
  calls.push("headers");
  return new Headers({ "x-fixture-session": registration });
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Keep the actual asynchronous Next header and Better Auth session signatures while returning fixed local service responses. */
const fixtureAuth = {
  api: {
    /* oxlint-disable eslint/require-await, typescript/require-await -- Keep Better Auth’s native completion promise while returning the fixed local session synchronously. */
    getSession: async ({
      headers,
    }: {
      readonly headers: Readonly<Pick<Headers, "get">>;
    }): Promise<Session | null> => {
      calls.push(`auth:${headers.get("x-fixture-session")}`);
      if (registration === "registered") {
        return fixtureSession;
      }
      /* oxlint-disable unicorn/no-null -- Better Auth represents an absent session with null. */
      return null;
      /* oxlint-enable unicorn/no-null */
    },
    /* oxlint-enable eslint/require-await, typescript/require-await */
  },
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable import/no-named-export -- Keep the named fixture bindings (fixtureAuth, fixtureHeaders, getServerCalls, setServerRegistration); enabled import/no-default-export and app guidance require named module APIs. */
export { fixtureAuth, fixtureHeaders, getServerCalls, setServerRegistration };
/* oxlint-enable import/no-named-export */
