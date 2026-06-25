import { useState } from "react";
import { useGenerateXeroInvoice } from "../../hooks/useXero";
import { ApiError } from "../../lib/api";
import type { CandidateTraining, XeroContact } from "../../types";
import { fmtDate } from "../../lib/utils";

interface Props {
  enrolment: CandidateTraining & { candidate_name?: string };
  candidateName: string;
  defaultUnitPrice: number | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function GenerateInvoiceDialog({ enrolment, candidateName, defaultUnitPrice, onClose, onSuccess }: Props) {
  const [unitPrice, setUnitPrice] = useState<string>(defaultUnitPrice?.toString() ?? "");
  const [quantity, setQuantity] = useState<string>("1");
  const [error, setError] = useState("");
  const [disambiguation, setDisambiguation] = useState<XeroContact[] | null>(null);

  const generate = useGenerateXeroInvoice();

  const description =
    `${enrolment.training_name}${candidateName ? ` — ${candidateName}` : ""}` +
    `${enrolment.start_date ? ` — ${fmtDate(enrolment.start_date)}` : ""}` +
    `${enrolment.end_date ? ` to ${fmtDate(enrolment.end_date)}` : ""}`;

  function submit(xeroContactId?: string) {
    setError("");
    if (!unitPrice) { setError("Unit price is required."); return; }
    generate.mutateAsync({
      candidate_training_id: enrolment.id,
      unit_price: Number(unitPrice),
      quantity:   Number(quantity || 1),
      xero_contact_id: xeroContactId,
    }).then(() => onSuccess())
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 409) {
          const body = err.body as { data?: { candidates?: XeroContact[] } };
          const candidates = body?.data?.candidates;
          if (Array.isArray(candidates)) { setDisambiguation(candidates); return; }
        }
        setError(err instanceof Error ? err.message : "Failed to generate invoice");
      });
  }

  if (disambiguation) {
    return (
      <Backdrop onClose={onClose}>
        <h2 className="text-lg font-semibold text-slate-900 mb-2">Pick a Xero contact</h2>
        <p className="text-sm text-slate-500 mb-3">Multiple Xero contacts match this provider name. Pick the right one — we'll cache the choice so you only do this once per provider.</p>
        <div className="border border-slate-100 rounded-lg divide-y divide-slate-100 max-h-64 overflow-y-auto mb-4">
          {disambiguation.length === 0 ? (
            <p className="p-4 text-xs text-slate-400">No Xero contact found by that name.</p>
          ) : disambiguation.map((c) => (
            <button
              key={c.contact_id}
              type="button"
              onClick={() => { setDisambiguation(null); submit(c.contact_id); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
            >
              <div className="text-slate-900">{c.name}</div>
              {c.email && <div className="text-xs text-slate-400">{c.email}</div>}
            </button>
          ))}
        </div>
        <div className="flex justify-end">
          <button onClick={() => setDisambiguation(null)} className="px-4 py-2 text-sm rounded-lg border border-slate-200 hover:bg-slate-50">Back</button>
        </div>
      </Backdrop>
    );
  }

  return (
    <Backdrop onClose={onClose}>
      <h2 className="text-lg font-semibold text-slate-900 mb-4">Generate invoice (DRAFT)</h2>
      <dl className="text-sm text-slate-600 space-y-1 mb-4">
        <div className="flex"><dt className="w-28 text-slate-400">Candidate</dt><dd className="text-slate-900">{candidateName}</dd></div>
        <div className="flex"><dt className="w-28 text-slate-400">Course</dt><dd>{enrolment.training_name}</dd></div>
        <div className="flex"><dt className="w-28 text-slate-400">Dates</dt><dd>{fmtDate(enrolment.start_date)} → {fmtDate(enrolment.end_date)}</dd></div>
      </dl>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="text-xs text-slate-500">Unit price (AUD) *</label>
          <input type="number" step="0.01" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-xs text-slate-500">Quantity</label>
          <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
        </div>
      </div>
      <div className="mb-3 text-xs text-slate-500">
        Description preview: <span className="text-slate-700">{description}</span>
      </div>
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-slate-200 hover:bg-slate-50">Cancel</button>
        <button onClick={() => submit()} disabled={generate.isPending}
          className="px-4 py-2 text-sm rounded-lg bg-[#e88e2e] text-white hover:bg-[#d07d20] disabled:opacity-50">
          {generate.isPending ? "Generating..." : "Generate invoice"}
        </button>
      </div>
    </Backdrop>
  );
}

function Backdrop({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
