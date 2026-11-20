// Public configuration, safe to read in the browser. Next inlines NEXT_PUBLIC_ variables into
// client bundles only when they are read by their literal names, so each one is spelled out.

export type SupabaseConfig = { url: string; anonKey: string };

function present(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** The Supabase project URL and anon key, or null when either is missing or empty. */
export function supabaseConfig(): SupabaseConfig | null {
  const url = present(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const anonKey = present(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (!url || !anonKey) return null;
  return { url, anonKey };
}
