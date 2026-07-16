import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { EnrolmentsTab } from "../components/training/EnrolmentsTab";
import { CohortEnrolTab } from "../components/training/CohortEnrolTab";
import type { TrainingStatus } from "../types";

export interface PrefilterToEnrolments {
  training_id?: string;
  date_from?: string;
  status?: TrainingStatus[];
}

export default function Training() {
  const [tab, setTab] = useState<"enrolments" | "cohort">("enrolments");
  // Allows the Cohort tab to push the user to Enrolments with pre-applied filters
  // after a successful bulk enrol.
  const [prefilter, setPrefilter] = useState<PrefilterToEnrolments | undefined>(undefined);

  function viewEnrolments(filters: PrefilterToEnrolments) {
    setPrefilter(filters);
    setTab("enrolments");
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">Training Program</h1>
        <p className="text-sm text-slate-500 mt-0.5">Track enrolments and run cohort enrolments</p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "enrolments" | "cohort")}>
        <TabsList>
          <TabsTrigger value="enrolments">Enrolments</TabsTrigger>
          <TabsTrigger value="cohort">Cohort enrol</TabsTrigger>
        </TabsList>

        <TabsContent value="enrolments" className="mt-4">
          <EnrolmentsTab prefilter={prefilter} onPrefilterConsumed={() => setPrefilter(undefined)} />
        </TabsContent>

        <TabsContent value="cohort" className="mt-4">
          <CohortEnrolTab onViewEnrolments={viewEnrolments} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
