// The whole red lines page body (ticket 09): a status line, the list with its rows, and at the foot
// of the sheet the add form and "Restore defaults". With no red lines at all it shows an empty
// state that offers the same two ways back. Presentational, so it renders in tests.

import type { StoredRedLine } from "../../lib/red-lines/store.ts";
import { emptyDraft } from "../../lib/red-lines/validation.ts";
import { EDIT_COPY } from "./edit-copy.ts";
import type { ConfirmEvent, ConfirmState, FormEvent, FormState } from "./edit-state.ts";
import { RedLineForm } from "./red-line-form.tsx";
import { RedLineList, type RowEditing } from "./red-line-list.tsx";
import type { SwitchEvent, SwitchState } from "./switch-state.ts";

export const PAGE_IDS = {
  notice: "red-lines-notice",
  add: "red-lines-add",
  addForm: "red-line-new",
  restore: "red-lines-restore",
  restoreWarning: "red-lines-restore-warning",
} as const;

export type RedLinesViewProps = {
  redLines: readonly StoredRedLine[];
  stateOf: (redLine: StoredRedLine) => SwitchState;
  send: (redLine: StoredRedLine, event: SwitchEvent) => void;
  editing: RowEditing;
  addForm: FormState;
  sendAdd: (event: FormEvent) => void;
  restore: ConfirmState;
  sendRestore: (event: ConfirmEvent) => void;
  /** What the last action did, read out and focused after a delete, an add or a restore. */
  notice: string | null;
};

function Footer({ addForm, sendAdd, restore, sendRestore }: Pick<RedLinesViewProps, "addForm" | "sendAdd" | "restore" | "sendRestore">) {
  return (
    <div className="red-line-footer">
      {addForm.kind === "closed" ? (
        <button
          type="button"
          id={PAGE_IDS.add}
          className="action action-secondary"
          onClick={() => sendAdd({ type: "open", draft: emptyDraft() })}
        >
          {EDIT_COPY.addOpen}
        </button>
      ) : (
        <RedLineForm
          idBase={PAGE_IDS.addForm}
          heading={EDIT_COPY.addHeading}
          headingLevel={2}
          state={addForm}
          submitLabel={EDIT_COPY.saveNew}
          send={sendAdd}
        />
      )}

      <div className="red-line-restore">
        <button
          type="button"
          id={PAGE_IDS.restore}
          className="quiet-button"
          disabled={restore.kind !== "idle"}
          aria-describedby={restore.kind === "confirming" ? PAGE_IDS.restoreWarning : undefined}
          onClick={() => sendRestore({ type: "ask" })}
        >
          {restore.kind === "working" ? EDIT_COPY.restoring : EDIT_COPY.restore}
        </button>
        {restore.kind === "confirming" ? (
          <div className="red-line-warning">
            <p id={PAGE_IDS.restoreWarning} role="alert" tabIndex={-1}>
              {EDIT_COPY.restoreWarning}
            </p>
            <div className="red-line-warning-actions">
              <button type="button" className="action action-secondary" onClick={() => sendRestore({ type: "confirm" })}>
                {EDIT_COPY.restoreConfirm}
              </button>
              <button type="button" className="quiet-button" onClick={() => sendRestore({ type: "cancel" })}>
                {EDIT_COPY.restoreCancel}
              </button>
            </div>
          </div>
        ) : null}
        {restore.kind === "idle" && restore.failed ? (
          <p className="account-error" role="alert">
            {EDIT_COPY.restoreFailed}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function RedLinesView(props: RedLinesViewProps) {
  const { redLines, stateOf, send, editing, notice } = props;
  const footer = <Footer {...props} />;
  return (
    <>
      <p className="red-line-notice" id={PAGE_IDS.notice} role="status" tabIndex={-1}>
        {notice}
      </p>
      {redLines.length === 0 ? (
        <section className="check-sheet red-line-sheet red-line-empty" aria-labelledby="red-lines-empty">
          <h2 id="red-lines-empty">{EDIT_COPY.emptyHeading}</h2>
          <p className="red-line-note">{EDIT_COPY.emptyBody}</p>
          {footer}
        </section>
      ) : (
        <RedLineList redLines={redLines} stateOf={stateOf} send={send} editing={editing} footer={footer} />
      )}
    </>
  );
}
