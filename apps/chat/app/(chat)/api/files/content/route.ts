import type { NextRequest } from "next/server";

import { createFileAccessResponse } from "@/lib/file-access-response";

/** Serve query-based URLs already persisted in chats and documents. */
export const GET = async (request: NextRequest) => {
  const keys = request.nextUrl.searchParams.getAll("key");
  if (keys.length !== 1) {
    return new Response("Invalid file key", { status: 400 });
  }
  return await createFileAccessResponse(request, keys[0]);
};
