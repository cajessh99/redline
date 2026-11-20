import "server-only";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { supabaseConfig } from "../env.ts";

/**
 * A Supabase client for server components, server actions and route handlers, reading and
 * writing the session cookies of the current request. Null when Supabase is not configured.
 * Create one per request.
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient | null> {
  const config = supabaseConfig();
  if (!config) return null;
  const cookieStore = await cookies();
  return createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server components cannot write cookies. The proxy refreshes the session on every
          // request, so a write dropped here is made there instead.
        }
      },
    },
  });
}

/**
 * The signed-in reader, checked against Supabase Auth (not just decoded from the cookie), so a
 * session ended by a global sign-out elsewhere counts as signed out. Null when signed out or when
 * Supabase is not configured.
 */
export async function currentReader(): Promise<User | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user;
}
