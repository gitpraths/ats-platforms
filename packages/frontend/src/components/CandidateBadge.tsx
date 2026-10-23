interface Props {
  srNo?: string | null;
  className?: string;
}

export function CandidateBadge({ srNo, className = "" }: Props) {
  if (!srNo) return null;
  return (
    <span
      className={`inline-flex items-center text-[10px] font-mono font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 flex-shrink-0 select-none ${className}`}
      title={`Candidate SR #${srNo}`}
    >
      {srNo}
    </span>
  );
}
