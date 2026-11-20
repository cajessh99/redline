"use client";

import { useActionState } from "react";
import { signIn, type SignInState } from "./actions.ts";

const initial: SignInState = { error: null, email: "" };

export function SignInForm() {
  const [state, action, pending] = useActionState(signIn, initial);
  return (
    <form action={action} className="account-form" noValidate>
      {state.error ? (
        <p className="account-error" role="alert">
          {state.error}
        </p>
      ) : null}
      <div className="field">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.email}
        />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <button type="submit" className="action" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
