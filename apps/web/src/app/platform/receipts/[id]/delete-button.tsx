"use client";

import { useFormStatus } from "react-dom";
import { deleteManualDocument } from "../actions";

function DeleteSubmit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/15 disabled:opacity-60"
    >
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}

export function DeleteDocumentButton({
  id,
  source,
  documentNo,
}: {
  id: string;
  source: "platform" | "subscription";
  documentNo: string;
}) {
  return (
    <form
      action={deleteManualDocument}
      onSubmit={(e) => {
        const ok = window.confirm(
          `Delete ${documentNo}? This cannot be undone.`,
        );
        if (!ok) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="source" value={source} />
      <DeleteSubmit />
    </form>
  );
}
