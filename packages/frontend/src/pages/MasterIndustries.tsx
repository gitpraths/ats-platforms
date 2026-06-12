import MasterTablePage from "./MasterTablePage";
export default function MasterIndustries() {
  return (
    <MasterTablePage
      title="Industries"
      description="Manage job industry categories used in Vacancies and Candidate Profiles."
      apiPath="/master/industries"
      queryKey="master-industries"
      placeholder="e.g. Cleaning, Warehouse, Security..."
    />
  );
}
