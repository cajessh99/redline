import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfig } from "../env.ts";
import { routeRequest } from "../routing.ts";

function redirectTo(request: NextRequest, pathname: string): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  return NextResponse.redirect(url);
}

/**
 * Runs before every page request. Refreshes the Supabase session cookies, then sends the request
 * where `routeRequest` says: signed-out requests for account pages to /sign-in, and a signed-in
 * reader at the root to the library. With Supabase not configured, nobody is signed in, so
 * everyone at the root sees the landing page and account pages always go to /sign-in, which says
 * accounts are not open yet.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const config = supabaseConfig();
  const pathname = request.nextUrl.pathname;
  if (!config) {
    const decision = routeRequest(pathname, false);
    return decision.kind === "redirect"
      ? redirectTo(request, decision.to)
      : NextResponse.next({ request });
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

  const decision = routeRequest(pathname, signedIn);
  if (decision.kind === "redirect") {
    // Carry any refreshed session cookies onto the redirect, or the reader is signed out by it.
    const redirect = redirectTo(request, decision.to);
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }
  return response;
}
