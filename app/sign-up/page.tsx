import { connection } from "next/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseConfig } from "../../lib/env.ts";
import { currentReader } from "../../lib/supabase/server.ts";
import { AccountPage, AccountsClosed } from "../auth/account-page.tsx";
import { SignUpForm } from "../auth/sign-up-form.tsx";

export const metadata = { title: "Sign up · Redline" };

export default async function SignUpPage() {
  await connection(); // depends on the request: the session cookie
  if (!supabaseConfig()) return <AccountsClosed />;
  if (await currentReader()) redirect("/library");

  return (
    <AccountPage aside={{ href: "/sign-in", label: "Sign in" }}>
      <SignUpForm />
      <p className="account-alt">
        <Link href="/check" className="quiet-link">
          Or check a contract without an account
        </Link>
      </p>
    </AccountPage>
  );
}
