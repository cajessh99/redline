import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { seedRedLinesAfterSignIn } from "../../../lib/server/red-line-store.ts";
import { createSupabaseServerClient } from "../../../lib/supabase/server.ts";

// The link in the sign-up confirmation email lands here. It carries either a PKCE code or a
// token hash, depending on the Supabase email template. Either one becomes a session.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const to = (path: string) => NextResponse.redirect(new URL(path, request.url));

  const supabase = await createSupabaseServerClient();
  if (!supabase) return to("/sign-in");

  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      await seedRedLinesAfterSignIn(supabase);
      return to("/library");
    }
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) {
      await seedRedLinesAfterSignIn(supabase);
      return to("/library");
    }
  }
  return to("/sign-in?error=confirm");
}
