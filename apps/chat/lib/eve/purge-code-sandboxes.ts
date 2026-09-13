import { APIError, Sandbox } from "@vercel/sandbox";

import {
  cleanupSandbox,
  resolveSandboxAuth,
} from "../../tools/chatjs/vercel-code-execution/sandbox";
import type { SandboxAuth } from "../../tools/chatjs/vercel-code-execution/sandbox";
import {
  listEveCodeSandboxesForDeletion,
  recordEveCodeSandboxDeletion,
} from "../db/eve-code-sandboxes";
import { createModuleLogger } from "../logger";
import { eveCodeSandboxName } from "./code-sandbox-name";

const findCodeSandbox = async (name: string, auth: SandboxAuth) => {
  try {
    return await Sandbox.get({
      name,
      resume: false,
      signal: AbortSignal.timeout(15_000),
      ...auth,
    });
  } catch (error) {
    if (error instanceof APIError && error.response.status === 404) {
      return;
    }
    throw error;
  }
};

/** Native work must already be retired. Never infer a failed create from provider absence. */
export const purgeEveFamilyCodeSandboxes = async (
  ownerId: string,
  rootId: string
) => {
  const resources = await listEveCodeSandboxesForDeletion(ownerId, rootId);
  const log = createModuleLogger("eve-code-sandbox-cleanup");
  const confirmedResources = resources.filter(
    (resource) => resource.creationConfirmed
  );
  if (confirmedResources.length === 0) {
    if (resources.length > 0) {
      throw new Error(
        "Resolve uncertain code sandbox creation before completing deletion."
      );
    }
    return;
  }
  const auth = resolveSandboxAuth();
  for (const resource of confirmedResources) {
    if (
      eveCodeSandboxName({
        callId: resource.callId,
        ownerId,
        provider: auth,
        sessionId: resource.sessionId ?? undefined,
      }) !== resource.name
    ) {
      throw new Error(
        "Code sandbox provider scope does not match its allocation intent."
      );
    }
    // Sandboxes are reconciled serially so one failed identity check stops release.
    // eslint-disable-next-line no-await-in-loop
    const sandbox = await findCodeSandbox(resource.name, auth);
    if (sandbox) {
      if (sandbox.name !== resource.name || sandbox.persistent) {
        throw new Error(
          "Code sandbox identity or persistence needs reconciliation."
        );
      }
      // Cleanup and absence confirmation form one ordered provider transaction.
      // eslint-disable-next-line no-await-in-loop
      await cleanupSandbox(sandbox, log, resource.name);
      // eslint-disable-next-line no-await-in-loop
      const remaining = await findCodeSandbox(resource.name, auth);
      if (remaining) {
        throw new Error("Code sandbox remains available after deletion.");
      }
    }
    // Release durable ownership only after provider absence is confirmed.
    // eslint-disable-next-line no-await-in-loop
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
};
