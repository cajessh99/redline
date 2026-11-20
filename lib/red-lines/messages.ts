// Copy about red lines shared by server code and the browser. Kept apart from lib/analysis so a
// client component can import it without pulling the analysis code into its bundle.

/**
 * Shown when every red line is switched off and a check is refused. The check page and the
 * change-party form follow it with a link to the red lines page (RED_LINES_LINK).
 */
export const NO_RED_LINES_MESSAGE =
  "All your red lines are switched off, so Redline has nothing to check this contract against. Switch at least one on first.";

/** The link text after NO_RED_LINES_MESSAGE. */
export const RED_LINES_LINK = "Go to your red lines";
