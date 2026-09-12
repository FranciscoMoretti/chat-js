import { APIError, Sandbox } from "@vercel/sandbox";
import { cleanupSandbox } from "../../tools/platform/code-execution.shared";
import {
  resolveSandboxAuth,
  type SandboxAuth,
} from "../../tools/platform/sandbox-auth";
import {
  listEveCodeSandboxesForDeletion,
  recordEveCodeSandboxDeletion,
} from "../db/eve-code-sandboxes";
import { createModuleLogger } from "../logger";
import { eveCodeSandboxName } from "./code-sandbox-name";

async function findCodeSandbox(name: string, auth: SandboxAuth) {
  try {
    return await Sandbox.get({
      name,
      resume: false,
      signal: AbortSignal.timeout(15_000),
      ...auth,
    });
  } catch (error) {
    if (error instanceof APIError && error.response.status === 404) {
      return undefined;
    }
    throw error;
  }
}

/** Native work must already be retired. Never infer a failed create from provider absence. */
export async function purgeEveFamilyCodeSandboxes(
  ownerId: string,
  rootId: string
) {
  const resources = await listEveCodeSandboxesForDeletion(ownerId, rootId);
  const log = createModuleLogger("eve-code-sandbox-cleanup");
  for (const resource of resources) {
    if (!resource.creationConfirmed) {
      continue;
    }
    const auth = await resolveSandboxAuth();
    if (
      eveCodeSandboxName({
        ownerId,
        sessionId: resource.sessionId ?? undefined,
        callId: resource.callId,
        provider: auth,
      }) !== resource.name
    ) {
      throw new Error(
        "Code sandbox provider scope does not match its allocation intent."
      );
    }
    const sandbox = await findCodeSandbox(resource.name, auth);
    if (sandbox) {
      if (sandbox.name !== resource.name || sandbox.persistent) {
        throw new Error(
          "Code sandbox identity or persistence needs reconciliation."
        );
      }
      await cleanupSandbox(sandbox, log, resource.name);
      if (await findCodeSandbox(resource.name, auth)) {
        throw new Error("Code sandbox remains available after deletion.");
      }
    }
    await recordEveCodeSandboxDeletion(
      ownerId,
      resource.conversationId,
      resource.name
    );
  }
  if (resources.some((resource) => !resource.creationConfirmed)) {
    throw new Error(
      "Resolve uncertain code sandbox creation before completing deletion."
    );
  }
}
