import type { APIRequestContext } from "@playwright/test";
import { z } from "zod";

export const readLogicalChatId = async (
  request: Pick<APIRequestContext, "get">,
  branchId: string
): Promise<string> => {
  const response = await request.get(`/api/agent-conversations/${branchId}`);
  if (!response.ok()) {
    throw new Error(
      `Could not read chat identity for branch ${branchId} (HTTP ${response.status()}): ${await response.text()}`
    );
  }
  return z.object({ chatId: z.uuid() }).parse(await response.json()).chatId;
};
