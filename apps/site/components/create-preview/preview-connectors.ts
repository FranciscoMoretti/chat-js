import { z } from "zod";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../chat/trpc/routers/_app";

type Outputs = inferRouterOutputs<AppRouter>;
const date = new Date("2026-01-01T00:00:00Z");

export const createConnectorFixtures = (failMutation: () => void) => {
  let connectors: Outputs["mcp"]["listConnected"] = [
    {
      id: "00000000-0000-4000-8000-000000000002",
      name: "Project knowledge",
      nameId: "project-knowledge",
      enabled: true,
      userId: "preview-user",
      type: "http",
      url: "https://example.invalid/mcp",
      requireApproval: true,
      oauthClientId: null,
      oauthClientSecret: null,
      createdAt: date,
      updatedAt: date,
    },
  ];
  const resolve = (path: string, input: unknown): unknown => {
    switch (path) {
      case "mcp.listConnected": {
        return connectors;
      }
      case "mcp.toggleEnabled": {
        const value = z
          .object({ id: z.uuid(), enabled: z.boolean() })
          .parse(input);
        failMutation();
        if (!connectors.some((connector) => connector.id === value.id)) {
          throw new Error("Unknown sample connector");
        }
        connectors = connectors.map((connector) =>
          connector.id === value.id
            ? { ...connector, enabled: value.enabled }
            : connector
        );
        return { success: true } satisfies Outputs["mcp"]["toggleEnabled"];
      }
      default: {
        throw new Error(`Unsupported connector preview operation: ${path}`);
      }
    }
  };
  return { resolve };
};
