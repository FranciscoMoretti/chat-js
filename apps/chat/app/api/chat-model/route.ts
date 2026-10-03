import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/* oxlint-disable no-magic-numbers, no-undefined, node/no-process-env, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --
 * no-magic-numbers (#517): POST uses 60, 24, 365 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * no-undefined (#519): POST uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * node/no-process-env (#537): POST reads process.env at the environment/configuration boundary; moving this access requires preserving runtime and test override behavior.
 * typescript/prefer-readonly-parameter-types (#565): POST accepts request: NextRequest; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): POST intentionally keeps the existing falsy-value behavior of model; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
// Route for updating selected-model cookie because setting in an action causes a refresh
export const POST = async (
  request: NextRequest
): Promise<
  NextResponse<{ error: string }> | NextResponse<{ success: boolean }>
> => {
  try {
    const body: unknown = await request.json();
    const model =
      typeof body === "object" && body !== null && "model" in body
        ? body.model
        : undefined;

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
/* oxlint-enable no-magic-numbers, no-undefined, node/no-process-env, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */
