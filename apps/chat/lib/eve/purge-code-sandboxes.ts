import { APIError, Sandbox } from "@vercel/sandbox";
import {
  cleanupSandbox,
  getTokenAuth,
} from "../../tools/platform/code-execution.shared";
import {
  listEveCodeSandboxesForDeletion,
  recordEveCodeSandboxDeletion,
} from "../db/eve-code-sandboxes";
import { createModuleLogger } from "../logger";

async function findCodeSandbox(name: string) {
  try {
    return await Sandbox.get({
      name,
      resume: false,
      signal: AbortSignal.timeout(15_000),
      ...getTokenAuth(),
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
    const sandbox = await findCodeSandbox(resource.name);
    if (sandbox) {
      if (sandbox.name !== resource.name || sandbox.persistent) {
        throw new Error(
          "Code sandbox identity or persistence needs reconciliation."
        );
      }
      await cleanupSandbox(sandbox, log, resource.name);
      if (await findCodeSandbox(resource.name)) {
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
