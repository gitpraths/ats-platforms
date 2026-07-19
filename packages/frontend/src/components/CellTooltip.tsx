import { useState, useRef } from "react";

export function CellTooltip({
  children,
  title,
  items,
}: {
  children: React.ReactNode;
  title: string;
  items: { key: string; value: React.ReactNode }[];
}) {
  const [show, setShow] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const visibleItems = items.filter((i) => {
    if (i.value === null || i.value === undefined || i.value === "") return false;
    if (typeof i.value === "string" && i.value.trim() === "") return false;
    return true;
  });

  function handleEnter() {
    if (ref.current) setRect(ref.current.getBoundingClientRect());
    setShow(true);
  }

  if (visibleItems.length === 0) return <>{children}</>;

  const above = rect ? rect.bottom > window.innerHeight - 180 : false;

  return (
    <div ref={ref} onMouseEnter={handleEnter} onMouseLeave={() => setShow(false)}>
      {children}
      {show && rect && (
        <div
          className="fixed z-[9999] bg-white border border-slate-200 rounded-xl shadow-xl text-xs pointer-events-none"
          style={
            above
              ? { left: Math.min(rect.left, window.innerWidth - 224), bottom: window.innerHeight - rect.top + 6 }
              : { left: Math.min(rect.left, window.innerWidth - 224), top: rect.bottom + 6 }
          }
        >
          {/* Arrow */}
          <div
            className={`absolute left-4 w-0 h-0 border-x-[6px] border-x-transparent ${
              above
                ? "bottom-[-6px] border-t-[6px] border-t-white"
                : "top-[-6px] border-b-[6px] border-b-white"
            }`}
            style={above ? { filter: "drop-shadow(0 1px 0 #e2e8f0)" } : { filter: "drop-shadow(0 -1px 0 #e2e8f0)" }}
          />
          <div className="p-3 w-52">
            <p className="font-semibold text-slate-700 border-b border-slate-100 pb-1.5 mb-2 text-[11px] uppercase tracking-wide">
              {title}
            </p>
            <div className="space-y-1.5">
              {visibleItems.map((i) => (
                <div key={i.key} className="flex justify-between gap-3">
                  <span className="text-slate-400 flex-shrink-0">{i.key}</span>
                  <span className="font-medium text-slate-700 text-right">{i.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
