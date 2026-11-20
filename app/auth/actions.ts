"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "../../lib/supabase/server.ts";
import { NOT_OPEN, authErrorMessage } from "./messages.ts";

export type SignInState = { error: string | null; email: string };
export type SignUpState =
  | { status: "form"; error: string | null; email: string }
  | { status: "check-email"; email: string };

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

async function siteOrigin(): Promise<string> {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = field(formData, "email").trim();
  const password = field(formData, "password");
  if (!email || !password) return { error: "Enter your email and password.", email };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: NOT_OPEN, email };

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return {
      error: authErrorMessage(error.code, "Redline couldn't sign you in. Try again in a minute."),
      email,
    };
  }
  redirect("/library");
}

export async function signUp(_prev: SignUpState, formData: FormData): Promise<SignUpState> {
  const email = field(formData, "email").trim();
  const password = field(formData, "password");
  if (!email || !password) {
    return { status: "form", error: "Enter an email and a password.", email };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { status: "form", error: NOT_OPEN, email };

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${await siteOrigin()}/auth/confirm` },
  });
  if (error) {
    return {
      status: "form",
      error: authErrorMessage(error.code, "Redline couldn't create your account. Try again in a minute."),
      email,
    };
  }
  // With email confirmation off, Supabase signs the reader in straight away.
  if (data.session) redirect("/library");
  return { status: "check-email", email };
}

/** Ends the session on every device, not just this browser (spec story 53). */
export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/sign-in");

  const { error } = await supabase.auth.signOut({ scope: "global" });
  if (error) {
    // The server could not be reached, so other devices keep their sessions. Clear this browser
    // anyway and say exactly what happened.
    await supabase.auth.signOut({ scope: "local" });
    redirect("/sign-in?signed-out=here");
  }
  redirect("/sign-in?signed-out=everywhere");
}
