import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { CandidateFormPanel, EMPTY_FORM } from "./CandidateFormPanel";
import type { CandidateFormData } from "./CandidateFormPanel";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function AddCandidateDialog({ isOpen, onClose }: Props) {
  const navigate     = useNavigate();
  const queryClient  = useQueryClient();

  const [form, setForm]       = useState<CandidateFormData>(EMPTY_FORM);
  const [error, setError]     = useState("");
  const [resumeUploading, setResumeUploading] = useState(false);

  const resumeFileRef = useRef<File | null>(null);

  // Reset form whenever dialog opens
  useEffect(() => {
    if (isOpen) {
      setForm(EMPTY_FORM);
      setError("");
      resumeFileRef.current = null;
    }
  }, [isOpen]);

  // Listen for resume file selection from CandidateFormPanel
  useEffect(() => {
    function onResume(e: Event) {
      resumeFileRef.current = (e as CustomEvent<File | null>).detail;
    }
    window.addEventListener("candidateFormResumeChange", onResume);
    return () => window.removeEventListener("candidateFormResumeChange", onResume);
  }, []);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (isOpen) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  const create = useMutation({
    mutationFn: async (snapshot: typeof form) => {
      const trainingIds = [...snapshot.training_ids];
      const candidate = await api.post<{ id: string }>("/candidates", {
        ...snapshot,
        name: [snapshot.first_name, snapshot.last_name].filter(Boolean).join(" "),
        benchmark_hours: snapshot.benchmark_hours ? Number(snapshot.benchmark_hours) : undefined,
        wage_subsidy_amount:
          snapshot.wage_subsidy && snapshot.wage_subsidy_amount
            ? Number(snapshot.wage_subsidy_amount)
            : undefined,
      });
      if (trainingIds.length > 0) {
        await Promise.allSettled(
          trainingIds.map((tid) =>
            api.post("/candidate-trainings", {
              candidate_id: candidate.id,
              training_id:  tid,
              status:       "enrolled",
            })
          )
        );
      }
      return candidate;
    },

    onSuccess: async (candidate: { id: string }) => {
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
      // Upload resume if selected (non-fatal)
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
      onClose();
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
    if (!form.car)             { setError("Car preference is required."); return; }
    create.mutate({ ...form });
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative z-10 w-full max-w-5xl mx-4 my-8 bg-white rounded-2xl shadow-2xl border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Add Candidate</h2>
            <p className="text-xs text-slate-400 mt-0.5">Fill in the details to register a new candidate</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body — reuse the existing CandidateFormPanel */}
        <div className="p-6">
          <CandidateFormPanel
            form={form}
            setForm={setForm}
            mode="create"
            error={error}
            isSubmitting={create.isPending || resumeUploading}
            onSubmit={handleSubmit}
            onCancel={onClose}
            submitLabel={
              resumeUploading ? "Uploading resume…" : create.isPending ? "Saving…" : "Save Candidate"
            }
            showResumeUpload={true}
          />
        </div>
      </div>
    </div>
  );
}
