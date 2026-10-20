import { isNonEmptyString } from "@/lib/is-non-empty-string";

import { timingSafeEqual } from "node:crypto";

import { z } from "zod";

import { frontendToolsSchema } from "@/lib/ai/types";
import { readEveGuestOwner } from "@/lib/db/eve-guests";
import {
  getDeletingEveConversationForSession,
  ownsEveSession,
  readEveSessionMapping,
} from "@/lib/db/eve-queries";
import { getEveSubagent } from "@/lib/db/eve-subagents";
import { env } from "@/lib/env";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { ANONYMOUS_LIMITS } from "@/lib/types/anonymous";

import { parseDeletionSessionRequest } from "./deletion-policy";
import { loadEveModelDefinition } from "./model-selection";
import { parseSessionRequest } from "./request-policy";

const compactionPath =
  /^\/eve\/v1\/session\/(?<sessionId>[A-Za-z0-9_-]+)\/compact$/u;

const authorizeDeletionRequest = async (
  request: ReadonlyNativeSurface<Request>,
  owner: string,
  path: string
): Promise<boolean> => {
  const sessionId = parseDeletionSessionRequest(path, request.method);
  if (sessionId === null) {
    return false;
  }
  return Boolean(await getDeletingEveConversationForSession(owner, sessionId));
};

const gatewaySessionPolicy = (
  path: string,
  method: string
): ReturnType<typeof parseSessionRequest> | { sessionId: string } => {
  const compactionSession =
    method === "POST" && (compactionPath.exec(path) ?? [])[1];
  if (typeof compactionSession === "string" && compactionSession.length > 0) {
    return { sessionId: compactionSession };
  }
  return parseSessionRequest(path, method);
};

const readCreationReservation = async (
  request: ReadonlyNativeSurface<Request>,
  owner: string
): Promise<string | null> => {
  const command = z
    .object({ operationId: z.uuid(), seed: z.boolean().optional() })
    .safeParse(
      await request
        .clone()
        .json()
        .catch(() => null)
    );
  if (!command.success) {
    return null;
  }
  const reservation = await readEveSessionMapping({
    reservationId: command.data.operationId,
  });
  if (
    reservation === null ||
    reservation.ownerId !== owner ||
    reservation.state === "deleting" ||
    reservation.state === "deleted" ||
    (reservation.creationKind === "copy" && command.data.seed !== true) ||
    (command.data.seed === true &&
      reservation.creationKind !== "copy" &&
      !isNonEmptyString(reservation.parentConversationId))
  ) {
    return null;
  }
  return reservation.id;
};

const readGatewayAttributes = async (
  request: ReadonlyNativeSurface<Request>,
  owner: string
): Promise<Record<string, string> | null> => {
  const modelId = request.headers.get("x-chatjs-model") ?? undefined;
  if (isNonEmptyString(modelId)) {
    await loadEveModelDefinition(modelId);
  }
  const toolHeader = request.headers.get("x-chatjs-tool");
  const selectedTool = frontendToolsSchema
    .optional()
    .safeParse(toolHeader ?? undefined);
  if (!selectedTool.success) {
    return null;
  }
  const attributes: Record<string, string> = {};
  if (selectedTool.data) {
    attributes.selectedTool = selectedTool.data;
  }
  if (isNonEmptyString(modelId)) {
    attributes.modelId = modelId;
  }
  if (
    new URL(request.url).pathname === "/eve/v1/session" &&
    request.method === "POST"
  ) {
    const reservationId = await readCreationReservation(request, owner);
    if (!isNonEmptyString(reservationId)) {
      return null;
    }
    // Derive this from the authenticated command and durable reservation, never a header.
    attributes.chatjsReservationId = reservationId;
  }
  return attributes;
};

const guestAttributesAllowed = (
  expiresAt: ReadonlyNativeSurface<Date>,
  attributes: Readonly<Record<string, string>>,
  requiresModel: boolean
): boolean =>
  expiresAt > new Date() &&
  (!requiresModel || Boolean(attributes.modelId)) &&
  (!attributes.modelId ||
    ANONYMOUS_LIMITS.AVAILABLE_MODELS.some(
      (model) => model === attributes.modelId
    )) &&
  (!attributes.selectedTool ||
    ANONYMOUS_LIMITS.AVAILABLE_TOOLS.some(
      (tool) => tool === attributes.selectedTool
    ));

const ownsGatewaySession = async (
  owner: string,
  sessionId: string,
  path: string,
  method: string
): Promise<boolean> => {
  if (await ownsEveSession(owner, sessionId)) {
    return true;
  }
  // Native child bindings authorize internal stream reads, never mutations.
  if (method !== "GET" || path !== `/eve/v1/session/${sessionId}/stream`) {
    return false;
  }
  return Boolean(await getEveSubagent(owner, sessionId));
};

export const authenticateEveGateway = async (
  request: ReadonlyNativeSurface<Request>
): Promise<{
  attributes: Record<string, string>;
  authenticator: string;
  issuer: string;
  principalId: string;
  principalType: string;
  subject: string;
} | null> => {
  if (!env.EVE_GATEWAY_SECRET) {
    return null;
  }
  const expected = Buffer.from(`Bearer ${env.EVE_GATEWAY_SECRET}`);
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return null;
  }
  const owner = request.headers.get("x-chatjs-owner");
  if (!isNonEmptyString(owner)) {
    return null;
  }
  const path = new URL(request.url).pathname;
  if (request.headers.get("x-chatjs-deletion") === "1") {
    if (!(await authorizeDeletionRequest(request, owner, path))) {
      return null;
    }
  } else if (!(path === "/eve/v1/session" && request.method === "POST")) {
    const policy = gatewaySessionPolicy(path, request.method);
    if (
      !(
        policy &&
        (await ownsGatewaySession(
          owner,
          policy.sessionId,
          path,
          request.method
        ))
      )
    ) {
      return null;
    }
  }
  const attributes = await readGatewayAttributes(request, owner);
  if (!attributes) {
    return null;
  }
  const guest = await readEveGuestOwner(owner);
  if (
    guest !== null &&
    request.headers.get("x-chatjs-deletion") !== "1" &&
    !guestAttributesAllowed(
      guest.expiresAt,
      attributes,
      path === "/eve/v1/session"
    )
  ) {
    return null;
  }
  if (guest !== null) {
    attributes.chatjsGuest = "true";
  }
  return {
    attributes,
    authenticator: "chatjs-gateway",
    issuer: "chatjs",
    principalId: owner,
    principalType: "user",
    subject: owner,
  };
};
