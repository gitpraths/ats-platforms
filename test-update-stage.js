const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:haGIrduketvrarPqPERryLGwRbvSoJkD@kodama.proxy.rlwy.net:56435/railway' });

async function run() {
  const { rows: apps } = await pool.query("SELECT id, stage, interview_date, ets_date, placement_date FROM applications WHERE placement_date IS NULL AND ets_date IS NULL LIMIT 1;");
  if (!apps[0]) return console.log("No apps found");
  console.log("Before:", apps[0]);
  
  // mimic backend logic
  let targetStage = apps[0].stage;
  const placement_date = undefined;
  const ets_date = undefined;
  const interview_date = "2026-10-10";
  
  const finalPlacement = placement_date !== undefined ? placement_date : apps[0].placement_date;
  const finalEts       = ets_date !== undefined ? ets_date : apps[0].ets_date;
  const finalInterview = interview_date !== undefined ? interview_date : apps[0].interview_date;

  let computedStage = "applied";
  if (finalPlacement) computedStage = "hired";
  else if (finalEts) computedStage = "ets";
  else if (finalInterview) computedStage = "interview";

  if (computedStage === "applied" && apps[0].stage === "screening") computedStage = "screening";
  if (apps[0].stage !== "rejected") targetStage = computedStage;
  
  console.log("After computing targetStage:", targetStage);
  
  pool.end();
}
run();
