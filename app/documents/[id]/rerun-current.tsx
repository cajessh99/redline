"use client";

import { useState } from "react";
import { CheckError } from "../../analysis/check-error.tsx";
import { DOCUMENT_COPY } from "./document-copy.ts";

type Props = {
  /** Runs the check again and shows the new result. Resolves to an error message, or null. */
  rerun: () => Promise<string | null>;
  /** True while another rerun (such as a party change) is running. */
  disabled?: boolean;
};

/**
 * "Check again with my current red lines" (story 51). The result on screen stays until the new
 * one is in; a failure says so in place and leaves it as it was.
 */
export function RerunCurrent({ rerun, disabled = false }: Props) {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function run() {
    if (running) return;
    setRunning(true);
    setError(null);
    setDone(false);
    const message = await rerun();
    setRunning(false);
    if (message) setError(message);
    else setDone(true);
  }

  return (
    <div className="document-rerun">
      <p className="check-lead">{DOCUMENT_COPY.rerunHint}</p>
      {error ? <CheckError message={error} /> : null}
      <button type="button" className="action action-secondary" onClick={() => void run()} disabled={running || disabled}>
        {running ? DOCUMENT_COPY.rerunRunning : DOCUMENT_COPY.rerun}
      </button>
      <p className="check-status" role="status">
        {running ? DOCUMENT_COPY.rerunStatus : done ? DOCUMENT_COPY.rerunDone : ""}
      </p>
    </div>
  );
}
