"use server";

import { redirect } from "next/navigation";
import { deleteDocument } from "../../../lib/documents/library.ts";
import { supabaseLibraryTransport } from "../../../lib/server/library-store.ts";
import { createSupabaseServerClient } from "../../../lib/supabase/server.ts";
import { DOCUMENT_COPY } from "./document-copy.ts";

export type DeleteState = { error: string | null };

/**
 * Deletes the signed-in reader's document, with its analyses and questions (story 49), then goes
 * to the library with a status line. Runs under the reader's own session, so another reader's
 * document is not found and nothing is deleted.
 */
export async function deleteDocumentAction(_prev: DeleteState, formData: FormData): Promise<DeleteState> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/sign-in");
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/sign-in");

  const outcome = await deleteDocument(supabaseLibraryTransport(supabase), formData.get("documentId"), (message) =>
    console.error(`[library] ${message}`),
  );
  if (!outcome.ok) {
    return { error: outcome.code === "not_found" ? DOCUMENT_COPY.deleteNotFound : DOCUMENT_COPY.deleteFailed };
  }
  redirect("/library?deleted=1");
}
