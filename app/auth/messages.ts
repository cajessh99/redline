// Plain messages for auth failures. Supabase's own messages are written for developers, so the
// reader sees one of these instead. Keyed by Supabase's error codes.

export const NOT_OPEN = "Accounts aren't open yet.";

const byCode: Record<string, string> = {
  invalid_credentials: "That email and password don't match an account.",
  email_not_confirmed:
    "Confirm your email first. The link is in the email Redline sent when you signed up.",
  user_already_exists: "There's already an account with that email. Sign in instead.",
  email_exists: "There's already an account with that email. Sign in instead.",
  email_address_invalid: "That email address isn't valid.",
  weak_password: "That password is too short or too easy to guess. Try a longer one.",
  signup_disabled: "Redline isn't taking new accounts right now.",
  over_request_rate_limit: "Too many tries. Wait a minute, then try again.",
  over_email_send_rate_limit: "Redline has sent too many emails to that address. Wait a few minutes, then try again.",
};

export function authErrorMessage(code: string | undefined, fallback: string): string {
  return (code && byCode[code]) || fallback;
}
