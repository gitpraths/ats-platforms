import type { PrefilterToEnrolments } from "../../pages/Training";

export function EnrolmentsTab({
  prefilter: _prefilter,
  onPrefilterConsumed: _onPrefilterConsumed,
}: {
  prefilter?: PrefilterToEnrolments;
  onPrefilterConsumed: () => void;
}) {
  return <p className="text-sm text-slate-500">Enrolments tab — coming in Task 8.</p>;
}
