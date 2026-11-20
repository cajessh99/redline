"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { deleteDocumentAction, type DeleteState } from "./actions.ts";
import { DOCUMENT_COPY } from "./document-copy.ts";

const OPENER_ID = "document-delete";
const WARNING_ID = "document-delete-warning";

/**
 * "Delete this contract" with an inline confirm (story 49), never a browser dialog. The warning
 * says what goes; only "Delete it" sends the request. On success the server goes to the library.
 */
export function DeleteDocument({ documentId }: { documentId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState<DeleteState, FormData>(deleteDocumentAction, { error: null });
  const focusNext = useRef<"warning" | "opener" | null>(null);

  useEffect(() => {
    const target = focusNext.current;
    if (!target) return;
    focusNext.current = null;
    document.getElementById(target === "warning" ? WARNING_ID : OPENER_ID)?.focus();
  }, [confirming]);

  // A failed delete closes the confirm and says why beside the button.
  useEffect(() => {
    if (state.error) {
      focusNext.current = "opener";
      setConfirming(false);
    }
  }, [state]);

  return (
    <div className="document-delete">
      <button
        type="button"
        id={OPENER_ID}
        className="quiet-button"
        disabled={confirming || pending}
        aria-describedby={confirming ? WARNING_ID : undefined}
        onClick={() => {
          focusNext.current = "warning";
          setConfirming(true);
        }}
      >
        {DOCUMENT_COPY.delete}
      </button>
      {state.error && !confirming ? (
        <p className="account-error" role="alert">
          {state.error}
        </p>
      ) : null}
      {confirming ? (
        <form action={action} className="red-line-warning">
          <input type="hidden" name="documentId" value={documentId} />
          <p id={WARNING_ID} role="alert" tabIndex={-1}>
            {DOCUMENT_COPY.deleteWarning}
          </p>
          <div className="red-line-warning-actions">
            <button type="submit" className="action action-secondary" disabled={pending}>
              {pending ? DOCUMENT_COPY.deleting : DOCUMENT_COPY.deleteConfirm}
            </button>
            <button
              type="button"
              className="quiet-button"
              disabled={pending}
              onClick={() => {
                focusNext.current = "opener";
                setConfirming(false);
              }}
            >
              {DOCUMENT_COPY.deleteCancel}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
