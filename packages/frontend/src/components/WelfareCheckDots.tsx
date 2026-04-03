import type { WelfareCheck, WelfareCheckType } from "../types";

const CHECK_ORDER: WelfareCheckType[] = ["day_1", "week_1", "month_1", "month_3", "month_6"];
const CHECK_LABELS: Record<WelfareCheckType, string> = {
  day_1:   "Day 1",
  week_1:  "Week 1",
  month_1: "1 Month",
  month_3: "3 Months",
  month_6: "6 Months",
};

interface Props {
  checks: WelfareCheck[];
}

function getDotColor(check: WelfareCheck | undefined, today: string): string {
  if (!check) return "bg-gray-200";
  if (check.completed_at) return "bg-green-500";
  if (check.due_date <= today) return "bg-yellow-400";
  return "bg-gray-200";
}

export default function WelfareCheckDots({ checks }: Props) {
  const today = new Date().toISOString().split("T")[0];
  const checkMap = Object.fromEntries(checks.map((c) => [c.check_type, c]));

  return (
    <div className="flex items-center gap-1">
      {CHECK_ORDER.map((type) => {
        const check = checkMap[type] as WelfareCheck | undefined;
        const color = getDotColor(check, today);
        const label = CHECK_LABELS[type];
        const status = check?.completed_at
          ? "Completed"
          : check?.due_date && check.due_date <= today
            ? `Overdue (${check.due_date})`
            : check
              ? `Due ${check.due_date}`
              : "Pending";

        return (
          <div key={type} className="relative group">
            <div className={`w-3 h-3 rounded-full ${color}`} />
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 pointer-events-none">
              <div className="bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                {label}: {status}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
