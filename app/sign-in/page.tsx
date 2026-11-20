import { connection } from "next/server";
import { redirect } from "next/navigation";
import { supabaseConfig } from "../../lib/env.ts";
import { currentReader } from "../../lib/supabase/server.ts";
import { AccountPage, AccountsClosed } from "../auth/account-page.tsx";
import { SignInForm } from "../auth/sign-in-form.tsx";

export const metadata = { title: "Sign in · Redline" };

const signedOutNotices: Record<string, string> = {
  everywhere: "You're signed out on every device.",
  here:
    "You're signed out on this device. Redline couldn't reach its server, so your other devices are still signed in. Sign in and sign out again to end those sessions.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection(); // depends on the request: the session cookie
  if (!supabaseConfig()) return <AccountsClosed />;
  if (await currentReader()) redirect("/library");

  const params = await searchParams;
  const signedOutKey = params["signed-out"];
  const signedOut = typeof signedOutKey === "string" ? signedOutNotices[signedOutKey] : undefined;
  const confirmFailed = params.error === "confirm";

  return (
    <AccountPage aside={{ href: "/sign-up", label: "Create an account" }}>
      <h1 className="account-title">Sign in</h1>
      {signedOut ? (
        <p className="account-notice" role="status">
          {signedOut}
        </p>
      ) : null}
      {confirmFailed ? (
        <p className="account-error" role="alert">
          That confirmation link has expired or was already used. Try signing in, and if that fails,
          sign up again to get a new link.
        </p>
      ) : null}
      <SignInForm />
    </AccountPage>
  );
}
