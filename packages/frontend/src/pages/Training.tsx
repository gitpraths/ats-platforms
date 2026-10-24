import { useState } from "react";
import { UserPlus } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { EnrolmentsTab } from "../components/training/EnrolmentsTab";
import { CohortEnrolTab } from "../components/training/CohortEnrolTab";
import { EnrolmentDialog } from "../components/training/EnrolmentDialog";
import { usePermissions } from "../hooks/usePermissions";
import type { TrainingStatus } from "../types";

export interface PrefilterToEnrolments {
  training_id?: string;
  date_from?: string;
  status?: TrainingStatus[];
}

export default function Training() {
  const [tab, setTab] = useState<"enrolments" | "cohort">("enrolments");
  const [showAddModal, setShowAddModal] = useState(false);
  // Allows the Cohort tab to push the user to Enrolments with pre-applied filters
  // after a successful bulk enrol.
  const [prefilter, setPrefilter] = useState<PrefilterToEnrolments | undefined>(undefined);

  const { hasPermission, isAdmin } = usePermissions();
  const canEnrol = isAdmin || hasPermission("training:enroll");

  function viewEnrolments(filters: PrefilterToEnrolments) {
    setPrefilter(filters);
    setTab("enrolments");
  }

  return (
    <div className="min-h-screen bg-[#F1F5F9] px-4 py-4 sm:px-6 sm:py-5">
      <div className="w-full max-w-7xl xl:max-w-[1500px] 2xl:max-w-[1600px] mx-auto border border-slate-200 rounded-2xl shadow-sm bg-[#F8FAFC] p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">Training Program</h1>
            <p className="text-sm text-slate-500 mt-0.5">Track enrolments and run cohort enrolments</p>
          </div>
          {canEnrol && (
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#e88e2e] text-white rounded-lg text-sm font-medium hover:bg-[#d07d20] shadow-sm transition self-start sm:self-auto"
            >
              <UserPlus size={16} /> + Add Candidate
            </button>
          )}
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "enrolments" | "cohort")}>
          <TabsList>
            <TabsTrigger value="enrolments">Enrolments</TabsTrigger>
            {canEnrol && <TabsTrigger value="cohort">Cohort enrol</TabsTrigger>}
          </TabsList>

          <TabsContent value="enrolments" className="mt-4">
            <EnrolmentsTab prefilter={prefilter} onPrefilterConsumed={() => setPrefilter(undefined)} />
          </TabsContent>

          {canEnrol && (
            <TabsContent value="cohort" className="mt-4">
              <CohortEnrolTab onViewEnrolments={viewEnrolments} />
            </TabsContent>
          )}
        </Tabs>

        {showAddModal && (
          <EnrolmentDialog
            enrolment={null}
            onClose={() => setShowAddModal(false)}
          />
        )}
      </div>
    </div>
  );
}
