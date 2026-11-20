"use client";

import { useEffect, useState } from "react";

/**
 * A readable date ("20 Nov 2026", "Nov 20, 2026") in the given locale and time zone. Undefined
 * locale and time zone mean the runtime's own. An unreadable date is shown as it came.
 */
export function formatLibraryDate(iso: string, locale?: string, timeZone?: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone }).format(date);
  } catch {
    // An unknown locale tag from a request header: fall back to the runtime's default locale.
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeZone }).format(date);
  }
}

/**
 * The server renders the date in the request's preferred language and UTC. Once in the browser it
 * is formatted again in the reader's own locale and time zone, so a contract checked late in the
 * evening shows that day, not the next.
 */
export function LocalDate({ iso, fallbackLocale }: { iso: string; fallbackLocale: string }) {
  const [text, setText] = useState(() => formatLibraryDate(iso, fallbackLocale, "UTC"));
  useEffect(() => {
    setText(formatLibraryDate(iso));
  }, [iso]);
  return <time dateTime={iso}>{text}</time>;
}
