import MasterTablePage from "./MasterTablePage";
export default function MasterWorkTypes() {
  return (
    <MasterTablePage
      title="Work Types"
      description="Manage work type options shown in the Vacancy form (e.g. Full-time, Part-time, Casual)."
      apiPath="/master/work-types"
      queryKey="master-work-types"
      placeholder="e.g. Full-time, Part-time, Casual..."
    />
  );
}
