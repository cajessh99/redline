// Copy for editing, adding, deleting and restoring red lines (ticket 09). Run through the humanizer
// skill; no banned word from PRODUCT.md. The tier hints follow PRD section 5's definitions: Severe
// takes something unrecoverable, Moderate costs bounded money or time, Minor is friction.

import type { Tier } from "../../lib/red-lines/defaults.ts";

export const EDIT_COPY = {
  edit: "Edit",
  delete: "Delete",
  editHeading: "Edit this red line",
  addHeading: "Add your own red line",
  addOpen: "Add a red line",
  titleLabel: "Title",
  titleHint: "A short name. Every flag from this red line shows it.",
  descriptionLabel: "What matches",
  descriptionHint: "In plain English, what a clause has to say to match.",
  tiersLegend: "How serious a match is",
  tiersHint: "Fill in at least one tier. Leave a tier empty and this red line won't flag anything at that level.",
  tierHints: {
    Severe: "The clause takes something you can't get back.",
    Moderate: "The clause costs you a limited amount of money or time.",
    Minor: "Friction you can live with.",
  } satisfies Record<Tier, string>,
  pastResults: "Contracts you've already checked keep the wording they were checked against.",
  save: "Save changes",
  saveNew: "Add it",
  cancel: "Cancel",
  saving: "Saving…",
  saveFailed: "Redline couldn't save this. Your wording is still here. Try again.",
  deleteWarningProduct:
    "Delete this and Redline stops flagging this risk in contracts you check from now on. Nothing else in Redline looks for it. Restore defaults brings it back.",
  deleteWarningOwn:
    "Delete this and Redline stops flagging this risk in contracts you check from now on. Nothing else in Redline looks for it, and you'd have to write it again to get it back.",
  deleteConfirm: "Delete it",
  deleteCancel: "Keep it",
  deleting: "Deleting…",
  deleteFailed: "Redline couldn't delete this red line, so it's still on your list. Try again.",
  deleted: (title: string) => `Deleted “${title}”.`,
  added: (title: string) => `Added “${title}”. It's switched on.`,
  saved: (title: string) => `Saved “${title}”.`,
  restore: "Restore defaults",
  restoreWarning:
    "This puts the eleven red lines Redline comes with back to their original wording and on/off settings, and brings back any you deleted. Red lines you wrote stay as they are.",
  restoreConfirm: "Restore them",
  restoreCancel: "Keep my changes",
  restoring: "Restoring…",
  restored: "The eleven red lines Redline comes with are back to their original wording and settings.",
  restoreFailed: "Redline couldn't restore the defaults, so nothing changed. Try again.",
  emptyHeading: "You have no red lines",
  emptyBody:
    "Redline has nothing to check a contract against. Write a red line of your own, or restore the eleven Redline comes with.",
} as const;
