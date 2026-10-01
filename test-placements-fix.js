const fs = require("fs");

function fixInlineDateCell(filePath) {
  let content = fs.readFileSync(filePath, "utf-8");

  // Fix CandidateDetail.tsx InlineDateCellDetail
  if (content.includes("function InlineDateCellDetail")) {
    content = content.replace(
      /async function handleChange\(e: React\.ChangeEvent<HTMLInputElement>\) {\s+const newVal = e\.target\.value \|\| null;\s+setError\(null\);\s+if \(validate\) {\s+const err = validate\(newVal\);\s+if \(err\) { setError\(err\); return; }\s+}/g,
      `async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {\n    const newVal = e.target.value || null;\n    setError(null);\n    if (newVal !== null && validate) {\n      const err = validate(newVal);\n      if (err) { setError(err); return; }\n    }`
    );

    // Add Clear button in editing mode
    content = content.replace(
      /className="border border-\[#e88e2e\] rounded-lg px-2 py-1 text-xs focus:outline-none w-36"\s+\/>/g,
      `className="border border-[#e88e2e] rounded-lg px-2 py-1 text-xs focus:outline-none w-36"\n        />\n        {allowClear && <button type="button" onClick={clearValue} className="text-red-500 text-[10px] px-1.5 py-0.5 mt-1 border rounded bg-red-50 hover:bg-red-100 self-start">Clear</button>}`
    );
    
    // Add allowClear to applied_at, interview_date, ets_date
    content = content.replace(
      /field="applied_at"\s+value=\{app\.applied_at\}\s+onSaved=\{.*?\}/g,
      `field="applied_at"\n                        value={app.applied_at}\n                        onSaved={() => queryClient.invalidateQueries({ queryKey: ["candidate", candidateId] })}\n                        allowClear`
    );
    content = content.replace(
      /field="interview_date"\s+value=\{app\.interview_date\}\s+onSaved=\{.*?\}/g,
      `field="interview_date"\n                        value={app.interview_date}\n                        onSaved={() => queryClient.invalidateQueries({ queryKey: ["candidate", candidateId] })}\n                        allowClear`
    );
    content = content.replace(
      /field="ets_date"\s+value=\{app\.ets_date\}\s+onSaved=\{.*?\}/g,
      `field="ets_date"\n                        value={app.ets_date}\n                        onSaved={() => queryClient.invalidateQueries({ queryKey: ["candidate", candidateId] })}\n                        allowClear`
    );
  }

  // Fix Candidates.tsx InlineDateCell
  if (content.includes("function InlineDateCell")) {
    content = content.replace(
      /async function handleChange\(e: React\.ChangeEvent<HTMLInputElement>\) {\s+const newVal = e\.target\.value \|\| null;\s+setError\(null\);\s+if \(validate\) {\s+const err = validate\(newVal\);\s+if \(err\) { setError\(err\); return; }\s+}/g,
      `async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {\n    const newVal = e.target.value || null;\n    setError(null);\n    if (newVal !== null && validate) {\n      const err = validate(newVal);\n      if (err) { setError(err); return; }\n    }`
    );

    content = content.replace(
      /className="border border-slate-300 rounded px-1\.5 py-0\.5 text-\[10px\] focus:outline-none w-24"\s+\/>/g,
      `className="border border-slate-300 rounded px-1.5 py-0.5 text-[10px] focus:outline-none w-24"\n        />\n        {allowClear && <button type="button" onClick={clearValue} className="text-red-500 text-[10px] px-1 py-0.5 mt-0.5 border rounded bg-red-50 hover:bg-red-100 self-start">Clear</button>}`
    );
    
    content = content.replace(
      /field="interview_date"\s+value=\{row\.latest_interview_date\}\s+onSaved=\{.*?\}/g,
      `field="interview_date"\n                            value={row.latest_interview_date}\n                            onSaved={() => queryClient.invalidateQueries({ queryKey: ["candidate-pool"] })}\n                            allowClear`
    );
    content = content.replace(
      /field="ets_date"\s+value=\{row\.latest_ets_date\}\s+onSaved=\{.*?\}/g,
      `field="ets_date"\n                            value={row.latest_ets_date}\n                            onSaved={() => queryClient.invalidateQueries({ queryKey: ["candidate-pool"] })}\n                            allowClear`
    );
  }

  fs.writeFileSync(filePath, content, "utf-8");
}

fixInlineDateCell("packages/frontend/src/pages/CandidateDetail.tsx");
fixInlineDateCell("packages/frontend/src/pages/Candidates.tsx");
console.log("Fixed files");
