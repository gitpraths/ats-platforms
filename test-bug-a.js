const STAGE_ORDER = ["applied", "screening", "interview", "ets", "hired", "rejected"];
let currentStage = "applied";
let interview_date = "2026-07-20";
let ets_date = undefined;
let placement_date = undefined;

let autoStage = null;
if (placement_date)      autoStage = "hired";
else if (placement_date === null) {}
else if (interview_date) autoStage = "interview";
else if (ets_date)       autoStage = "ets";

console.log("autoStage:", autoStage);
if (autoStage && STAGE_ORDER.indexOf(autoStage) > STAGE_ORDER.indexOf(currentStage)) {
  console.log("Stage changed to", autoStage);
} else {
  console.log("Stage NOT changed");
}
