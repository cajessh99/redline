import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfig } from "../env.ts";

/** Paths that need a signed-in reader. Everything else is open. */
export function requiresAccount(pathname: string): boolean {
  return (
    pathname === "/library" ||
    pathname.startsWith("/library/") ||
    pathname === "/red-lines" ||
    pathname.startsWith("/red-lines/") ||
    pathname.startsWith("/documents/")
  );
}

function toSignIn(request: NextRequest): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = "/sign-in";
  url.search = "";
  return NextResponse.redirect(url);
}

/**
 * Runs before every page request. Refreshes the Supabase session cookies and sends signed-out
 * requests for account pages to /sign-in. With Supabase not configured, nobody is signed in, so
 * account pages always go to /sign-in, which says accounts are not open yet.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const config = supabaseConfig();
  const protectedPath = requiresAccount(request.nextUrl.pathname);
  if (!config) {
    return protectedPath ? toSignIn(request) : NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });

  // getUser asks Supabase Auth, so a session revoked by a global sign-out is rejected here.
  const { data, error } = await supabase.auth.getUser();
  const signedIn = !error && data.user !== null;

  if (protectedPath && !signedIn) {
    const redirect = toSignIn(request);
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }
  return response;
}
