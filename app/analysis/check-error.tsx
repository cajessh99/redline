import Link from "next/link";
import { NO_RED_LINES_MESSAGE, RED_LINES_LINK } from "../../lib/red-lines/messages.ts";

/**
 * A refused or failed check, said in place. When the refusal is that every red line is switched
 * off, it links to the red lines page where the reader can switch one on.
 */
export function CheckError({ message }: { message: string }) {
  return (
    <p className="account-error" role="alert">
      {message}
      {message === NO_RED_LINES_MESSAGE ? (
        <>
          {" "}
          <Link href="/red-lines">{RED_LINES_LINK}</Link>
        </>
      ) : null}
    </p>
  );
}
