import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const MODEL_COOKIE_MAX_AGE_SECONDS = 31_536_000;

// Route for updating selected-model cookie because setting in an action causes a refresh
export const POST = async (
  request: Readonly<Pick<NextRequest, "json">>
): Promise<
  NextResponse<{ error: string }> | NextResponse<{ success: boolean }>
> => {
  try {
    const body: unknown = await request.json();
    const model =
      typeof body === "object" && body !== null && "model" in body
        ? body.model
        : undefined;

    if (typeof model !== "string" || model === "") {
      return NextResponse.json(
        { error: "Invalid model parameter" },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    // One year.
    cookieStore.set("chat-model", model, {
      maxAge: MODEL_COOKIE_MAX_AGE_SECONDS,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to set cookie" },
      { status: 500 }
    );
  }
};
