"use client";

import { useActionState } from "react";
import { signUp, type SignUpState } from "./actions.ts";

const initial: SignUpState = { status: "form", error: null, email: "" };

export function SignUpForm() {
  const [state, action, pending] = useActionState(signUp, initial);

  if (state.status === "check-email") {
    return (
      <div role="status">
        <h1 className="account-title">Check your email</h1>
        <p className="account-lead">
          Redline sent a link to <strong>{state.email}</strong>. Open it to confirm your account.
        </p>
      </div>
    );
  }

  return (
    <>
      <h1 className="account-title">Create an account</h1>
      <p className="account-lead">An account keeps your documents and your red lines.</p>
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
            autoComplete="new-password"
            required
          />
        </div>
        <button type="submit" className="action" disabled={pending}>
          {pending ? "Creating your account…" : "Create account"}
        </button>
      </form>
    </>
  );
}
