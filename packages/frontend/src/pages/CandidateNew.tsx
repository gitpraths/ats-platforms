import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { api } from "../lib/api";
import { CandidateFormPanel, EMPTY_FORM } from "../components/CandidateFormPanel";
import type { CandidateFormData } from "../components/CandidateFormPanel";

export default function CandidateNew() {
  const navigate    = useNavigate();
  const queryClient = useQueryClient();

  const [form, setForm]   = useState<CandidateFormData>(EMPTY_FORM);
  const [error, setError] = useState("");
  const [resumeUploading, setResumeUploading] = useState(false);

  // Listen for resume file selection from CandidateFormPanel
  const resumeFileRef = useRef<File | null>(null);
  useEffect(() => {
    function onResume(e: Event) {
      resumeFileRef.current = (e as CustomEvent<File | null>).detail;
    }
    window.addEventListener("candidateFormResumeChange", onResume);
    return () => window.removeEventListener("candidateFormResumeChange", onResume);
  }, []);

  const create = useMutation({
    // Pass the entire form snapshot as the mutation argument so there is
    // zero stale-closure risk — the values are frozen at the time mutate() is called.
    mutationFn: async (snapshot: typeof form) => {
      const trainingIds = [...snapshot.training_ids];

      // 1. Create the candidate
      const candidate = await api.post<{ id: string }>("/candidates", {
        ...snapshot,
        name: [snapshot.first_name, snapshot.last_name].filter(Boolean).join(" "),
        benchmark_hours: snapshot.benchmark_hours ? Number(snapshot.benchmark_hours) : undefined,
        wage_subsidy_amount: snapshot.wage_subsidy && snapshot.wage_subsidy_amount
          ? Number(snapshot.wage_subsidy_amount)
          : undefined,
      });

      // 2. Enrol each selected training course
      if (trainingIds.length > 0) {
        const results = await Promise.allSettled(
          trainingIds.map((tid) =>
            api.post(`/candidate-trainings`, {
              candidate_id: candidate.id,
              training_id:  tid,
              status:       "enrolled",
            })
          )
        );
        // Surface any enrolment failures as a combined error message
        const failed = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
        if (failed.length > 0) {
          const msgs = failed.map((f) => (f.reason as Error).message).join("; ");
          console.error("Training enrolment failed:", msgs);
          throw new Error(`Candidate created, but ${failed.length} training enrolment(s) failed: ${msgs}`);
        }
      }

      return candidate;
    },

    onSuccess: async (candidate: { id: string }) => {
      queryClient.invalidateQueries({ queryKey: ["candidates"] });

      // Upload resume if one was selected (non-fatal)
      const file = resumeFileRef.current;
      if (file) {
        setResumeUploading(true);
        try {
          const fd = new FormData();
          fd.append("file", file);
          fd.append("document_type", "cv");
          const token = localStorage.getItem("token");
          await fetch(
            `${import.meta.env.VITE_API_URL || "http://localhost:3001/api"}/candidates/${candidate.id}/documents`,
            { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {}, body: fd }
          );
        } catch { /* non-fatal */ } finally { setResumeUploading(false); }
      }

      navigate(`/candidates/${candidate.id}`);
    },

    onError: (err: Error) => setError(err.message),
  });

  function handleSubmit() {
    setError("");
    const fullName = [form.first_name, form.last_name].filter(Boolean).join(" ");
    if (!fullName.trim())      { setError("First name is required."); return; }
    if (!form.phone)           { setError("Phone is required."); return; }
    if (!/^\d{10}$/.test(form.phone.replace(/\s/g, ""))) { setError("Phone must be 10 digits."); return; }
    if (!form.provider_id)     { setError("Provider is required."); return; }
    if (!form.benchmark_hours) { setError("Benchmark hours is required."); return; }
    // Pass a frozen snapshot of the form — no stale-closure risk inside mutationFn
    create.mutate({ ...form });
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* Back */}
        <Link to="/candidates"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2 hover:bg-slate-50 shadow-sm transition mb-5">
          <ArrowLeft size={14} /> Back to Candidates
        </Link>

        <h1 className="text-3xl font-semibold text-slate-900 tracking-tight mb-6">Add Candidate</h1>

        <CandidateFormPanel
          form={form}
          setForm={setForm}
          mode="create"
          error={error}
          isSubmitting={create.isPending || resumeUploading}
          onSubmit={handleSubmit}
          onCancel={() => navigate("/candidates")}
          submitLabel={resumeUploading ? "Uploading resume..." : create.isPending ? "Saving..." : "Save Candidate"}
          showResumeUpload={true}
        />
      </div>
    </div>
  );
}
