import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseConfig } from "../env.ts";

/** A Supabase client for client components, or null when Supabase is not configured. */
export function createSupabaseBrowserClient(): SupabaseClient | null {
  const config = supabaseConfig();
  if (!config) return null;
  return createBrowserClient(config.url, config.anonKey);
}
