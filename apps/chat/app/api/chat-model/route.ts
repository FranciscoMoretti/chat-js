import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const MODEL_COOKIE_MAX_AGE_SECONDS = 31_536_000;

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Framework discovery uses these named bindings (POST); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve POST's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable no-undefined, node/no-process-env -- no-undefined (#519): POST uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
node/no-process-env (#537): POST reads process.env at the environment/configuration boundary; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */

// Route for updating selected-model cookie because setting in an action causes a refresh
export const POST = async (
  request: Readonly<Pick<NextRequest, "json">>
): Promise<
  NextResponse<{ error: string }> | NextResponse<{ success: boolean }>
> => {
  try {
    const body: unknown = await request.json();
    const model =
      // oxlint-disable-next-line no-ternary -- Keep model as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable no-undefined, node/no-process-env */
