import type { NextRequest } from "next/server";
import { updateSession } from "./lib/supabase/session.ts";

export function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Every page request, but not Next's static files, the favicon, fonts, or images.
    "/((?!_next/static|_next/image|favicon.ico|fonts/|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
