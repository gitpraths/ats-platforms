import MasterTablePage from "./MasterTablePage";
export default function MasterWorkStatus() {
  return (
    <MasterTablePage
      title="Work Status"
      description="Manage candidate work status options (e.g. Job Seeking, Employed, Placed, Inactive)."
      apiPath="/master/work-status"
      queryKey="master-work-status"
      placeholder="e.g. Job Seeking, Employed, Placed..."
    />
  );
}
