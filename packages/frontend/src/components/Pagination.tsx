import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  perPage: number;
  onChange: (page: number) => void;
  label?: string; // e.g. "vacancies", "candidates"
}

export const PER_PAGE = 10;

export function usePagination<T>(items: T[], page: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / PER_PAGE));
  const safePage   = Math.min(page, totalPages);
  const paged      = items.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);
  return { paged, totalPages, safePage };
}

export default function Pagination({
  page, totalPages, total, perPage, onChange, label = "items",
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const from = (page - 1) * perPage + 1;
  const to   = Math.min(page * perPage, total);

  function pageNumbers(): (number | "...")[] {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | "...")[] = [];
    if (page <= 4) {
      pages.push(1, 2, 3, 4, 5, "...", totalPages);
    } else if (page >= totalPages - 3) {
      pages.push(1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
    } else {
      pages.push(1, "...", page - 1, page, page + 1, "...", totalPages);
    }
    return pages;
  }

  const base     = "flex items-center justify-center w-9 h-9 rounded-lg text-sm font-medium transition-all";
  const active   = `${base} bg-[#e88e2e] text-white shadow-sm`;
  const normal   = `${base} border border-slate-200 text-slate-600 hover:border-[#e88e2e] hover:text-[#e88e2e] bg-white`;
  const disabled = `${base} border border-slate-100 text-slate-300 cursor-not-allowed bg-white`;
  const icon     = `${base} border border-slate-200 text-slate-500 hover:border-[#e88e2e] hover:text-[#e88e2e] bg-white`;

  return (
    <div className="flex items-center justify-between py-3">
      <p className="text-sm text-slate-500">
        Showing <span className="font-medium text-slate-700">{from}–{to}</span> of{" "}
        <span className="font-medium text-slate-700">{total}</span> {label}
      </p>

      <div className="flex items-center gap-1">
        <button onClick={() => onChange(1)} disabled={page === 1}
          className={page === 1 ? disabled : icon} title="First page">
          <ChevronsLeft size={15} />
        </button>
        <button onClick={() => onChange(page - 1)} disabled={page === 1}
          className={page === 1 ? disabled : icon} title="Previous page">
          <ChevronLeft size={15} />
        </button>

        <div className="flex items-center gap-1 mx-1">
          {pageNumbers().map((p, i) =>
            p === "..." ? (
              <span key={`e${i}`} className="w-9 h-9 flex items-center justify-center text-slate-400 text-sm">···</span>
            ) : (
              <button key={p} onClick={() => onChange(p as number)}
                className={page === p ? active : normal}>{p}</button>
            )
          )}
        </div>

        <button onClick={() => onChange(page + 1)} disabled={page === totalPages}
          className={page === totalPages ? disabled : icon} title="Next page">
          <ChevronRight size={15} />
        </button>
        <button onClick={() => onChange(totalPages)} disabled={page === totalPages}
          className={page === totalPages ? disabled : icon} title="Last page">
          <ChevronsRight size={15} />
        </button>
      </div>
    </div>
  );
}
