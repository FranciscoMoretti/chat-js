import { createFileAccessResponse } from "@/lib/file-access-response";

export const GET = async (
  request: Request,
  { params }: { params: Promise<{ key: string }> }
) => {
  const { key } = await params;
  return await createFileAccessResponse(request, key);
};
