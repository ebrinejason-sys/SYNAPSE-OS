"use client";

export function PrintReceiptButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-xl border border-[#E8B84B]/40 bg-[#E8B84B]/10 px-4 py-2 text-sm font-semibold text-[#E8B84B] hover:bg-[#E8B84B]/15"
    >
      Print / Save PDF
    </button>
  );
}
