// What the saved document page says about checking again and deleting (ticket 10, stories 49 and
// 51). Run through the humanizer skill; checked against the banned-word list in tests.
import { RERUN_ERROR_MESSAGES } from "../../../lib/analysis/rerun.ts";

export const DOCUMENT_COPY = {
  rerun: "Check again with my current red lines",
  rerunHint:
    "Redline checks the saved text again against the red lines you have switched on now. The new result replaces this one on this page.",
  rerunRunning: "Checking…",
  rerunStatus: "Checking the contract against your current red lines. This can take a minute or two.",
  rerunDone: "Showing the new result, checked against your current red lines.",
  delete: "Delete this contract",
  deleteWarning:
    "This deletes the contract's text, every result and any questions you asked about it. You can't undo it.",
  deleteConfirm: "Delete it",
  deleteCancel: "Keep it",
  deleting: "Deleting…",
  deleteFailed: "Redline couldn't delete this contract. It's still saved. Try again in a minute.",
  deleteNotFound: RERUN_ERROR_MESSAGES.not_found,
} as const;
