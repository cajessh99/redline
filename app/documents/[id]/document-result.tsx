"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Flag, ReceiptLine } from "../../../lib/analysis/analyse.ts";
import type { CheckedRedLine } from "../../../lib/analysis/run.ts";
import { ResultView } from "../../analysis/result-view.tsx";
import { ChangeParty } from "../../check/change-party.tsx";
import { postCheck } from "../../check/post-check.ts";
import { DeleteDocument } from "./delete-document.tsx";
import { RerunCurrent } from "./rerun-current.tsx";

type Shown = { party: string; flags: Flag[]; receipt: ReceiptLine[]; checkedRedLines: CheckedRedLine[] };

type Props = Shown & {
  documentId: string;
  title: string;
  storedText: string;
  candidates: string[];
};

/**
 * A saved document's latest result, with "Change my party", "Check again with my current red
 * lines" and delete. A rerun happens on the server against the stored text; the new result
 * replaces this one on screen and is what the page shows from now on.
 */
export function DocumentResult({ documentId, title, storedText, candidates, ...initial }: Props) {
  const [shown, setShown] = useState<Shown>(initial);
  const router = useRouter();

  async function apply(url: string, body: Record<string, string>): Promise<string | null> {
    const outcome = await postCheck(url, body);
    if (!outcome.ok) return outcome.message;
    const { party: newParty, flags, receipt, checkedRedLines } = outcome.result;
    setShown({ party: newParty, flags, receipt, checkedRedLines });
    // Keeps the router cache in step with the stored party and analysis.
    router.refresh();
    return null;
  }

  return (
    <>
      <div className="check-intro">
        <h1 className="check-title">{title}</h1>
        <ChangeParty
          candidates={candidates}
          currentParty={shown.party}
          rerun={(party) => apply(`/api/documents/${documentId}/party`, { party })}
        />
        <RerunCurrent rerun={() => apply(`/api/documents/${documentId}/rerun`, {})} />
      </div>
      <div className="check-sheet">
        <ResultView
          storedText={storedText}
          party={shown.party}
          flags={shown.flags}
          receipt={shown.receipt}
          checkedRedLines={shown.checkedRedLines}
        />
      </div>
      <DeleteDocument documentId={documentId} />
    </>
  );
}
