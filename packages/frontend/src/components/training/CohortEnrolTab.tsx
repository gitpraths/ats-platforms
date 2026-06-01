import type { PrefilterToEnrolments } from "../../pages/Training";

export function CohortEnrolTab({
  onViewEnrolments: _onViewEnrolments,
}: {
  onViewEnrolments: (f: PrefilterToEnrolments) => void;
}) {
  return <p className="text-sm text-slate-500">Cohort enrol tab — coming in Task 9.</p>;
}
