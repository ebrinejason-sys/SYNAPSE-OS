"use client";

import { useFormStatus } from "react-dom";
import { deleteManualDocument } from "../actions";

function DeleteSubmit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg border border-red-500/30 px-2 py-1 text-xs text-red-300 hover:border-red-500/50 disabled:opacity-60"
    >
      {pending ? "…" : "Delete"}
    </button>
  );
}

export function DeleteDocumentLink({
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
        if (!window.confirm(`Delete ${documentNo}? This cannot be undone.`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="source" value={source} />
      <DeleteSubmit />
    </form>
  );
}
