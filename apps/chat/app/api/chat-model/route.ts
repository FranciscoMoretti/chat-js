import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Route for updating selected-model cookie because setting in an action causes a refresh
export const POST = async (request: NextRequest) => {
  try {
    const { model } = await request.json();

    if (!model || typeof model !== "string") {
      return NextResponse.json(
        { error: "Invalid model parameter" },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    // One year.
    cookieStore.set("chat-model", model, {
      maxAge: 60 * 60 * 24 * 365,
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
