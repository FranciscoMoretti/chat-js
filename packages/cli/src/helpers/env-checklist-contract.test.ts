import { expect, test } from "bun:test";

import { collectEnvChecklist } from "./env-checklist";

const unselectedTools = {
  codeExecution: false,
  deepResearch: false,
  imageGeneration: false,
  urlRetrieval: false,
  videoGeneration: false,
  webSearch: false,
} as const;
const unselectedFeatures = {
  attachments: false,
  documents: false,
  followupSuggestions: false,
  mcp: false,
  parallelResponses: false,
} as const;

test("preserves auth insertion order and skips unused requirement-description getters", () => {
  const reads: string[] = [];
  const entries = collectEnvChecklist({
    auth: {
      get github(): boolean {
        reads.push("github");
        return true;
      },
      get google(): boolean {
        reads.push("google");
        return true;
      },
      get vercel(): boolean {
        reads.push("vercel");
        return true;
      },
    },
    builtInTools: unselectedTools,
    coreFeatures: unselectedFeatures,
    gateway: "vercel",
    gatewayRequirements: [],
    installableToolEnvRequirements: [
      {
        get description(): string {
          throw new Error(
            "A nonempty variable description must short-circuit this getter."
          );
        },
        options: [["CUSTOM_TOKEN"]],
      },
    ],
  });
  expect(reads).toEqual(["github", "google", "vercel"]);
  expect(entries.map((entry: { readonly vars: string }) => entry.vars)).toEqual(
    [
      "AUTH_SECRET",
      "DATABASE_URL",
      "CUSTOM_TOKEN",
      "AUTH_GITHUB_ID + AUTH_GITHUB_SECRET",
      "AUTH_GOOGLE_ID + AUTH_GOOGLE_SECRET",
      "VERCEL_APP_CLIENT_ID + VERCEL_APP_CLIENT_SECRET",
    ]
  );
  const custom = entries.find(
    (entry: { readonly vars: string }) => entry.vars === "CUSTOM_TOKEN"
  );
  expect(custom).toHaveProperty("oneOfGroup");
  expect(custom && custom.oneOfGroup).toBeUndefined();
});
