import { useState, useRef } from "react";
import { displayEmail, stageLabel, fmtDate, fmtDateTime } from "../lib/utils";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Mail, Phone, MapPin, Edit2, Upload, Download, Trash2, FileText, Eye, ExternalLink, Car, Shield, Users, DollarSign, Building2, Calendar, CheckCircle, XCircle, User, Briefcase, Clock, Pencil, X } from "lucide-react";
import { api } from "../lib/api";
import { CandidateFormPanel, EMPTY_FORM } from "../components/CandidateFormPanel";
import type { CandidateFormData } from "../components/CandidateFormPanel";
import type { Candidate, ApplicationStage, CandidateDocument, CandidateNote, CandidateWorkStatus, CandidateTraining, TrainingStatus, Training } from "../types";
import { useAuth } from "../contexts/AuthContext";
import {
  useCandidateTrainings,
  useCreateEnrolment,
  useUpdateEnrolment,
  useDeleteEnrolment,
} from "../hooks/useCandidateTrainings";
import { useTrainings } from "../hooks/useTrainings";
import { GenerateInvoiceDialog } from "../components/training/GenerateInvoiceDialog";
import { useXeroInvoicesForEnrolment } from "../hooks/useXero";

const BASE_URL = import.meta.env.VITE_API_URL?.replace("/api", "") || "http://localhost:3001";

const TRAINING_BADGE: Record<TrainingStatus, string> = {
  enrolled:    "border border-slate-400 text-slate-600 bg-transparent",
  in_progress: "border border-blue-400 text-blue-600 bg-transparent",
  completed:   "border border-green-500 text-green-700 bg-transparent",
  withdrawn:   "border border-amber-400 text-amber-600 bg-transparent",
  failed:      "border border-red-400 text-red-500 bg-transparent",
};

const STAGE_BADGE: Record<ApplicationStage, string> = {
  applied:   "border border-blue-400 text-blue-600 bg-transparent",
  screening: "border border-purple-400 text-purple-600 bg-transparent",
  interview: "border border-amber-400 text-amber-600 bg-transparent",
  ets:       "border border-orange-400 text-orange-600 bg-transparent",
  hired:     "border border-green-500 text-green-700 bg-transparent",
  rejected:  "border border-red-400 text-red-500 bg-transparent",
};

const WORK_STATUS_BADGE: Record<CandidateWorkStatus, string> = {
  job_seeking: "border border-blue-400 text-blue-600 bg-transparent",
  employed:    "border border-green-500 text-green-700 bg-transparent",
  placed:      "border border-purple-400 text-purple-600 bg-transparent",
  inactive:    "border border-slate-400 text-slate-600 bg-transparent",
};

const DOC_TYPE_BADGE: Record<string, string> = {
  cv:           "border border-blue-400 text-blue-600 bg-transparent",
  cover_letter: "border border-purple-400 text-purple-600 bg-transparent",
  id:           "border border-orange-400 text-orange-600 bg-transparent",
  certificate:  "border border-green-500 text-green-700 bg-transparent",
  other:        "border border-slate-400 text-slate-600 bg-transparent",
};

const DOC_TYPE_LABEL: Record<string, string> = {
  cv:           "Resume / CV",
  cover_letter: "Cover Letter",
  id:           "ID Document",
  certificate:  "Certificate",
  other:        "Other",
};

interface CandidateWithApps extends Candidate {
  applications: {
    id: string;
    stage: ApplicationStage;
    source: string;
    score: number;
    applied_at: string;
    job_title: string;
  }[];
}

export default function CandidateDetail() {
  const { id }      = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { user }    = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "recruiter_admin";
  const canWrite = user?.role !== "provider";

  const [activeTab, setActiveTab] = useState<"overview"|"documents"|"training"|"applications"|"notes">("overview");
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<CandidateFormData>(EMPTY_FORM);
  const [saveError, setSaveError] = useState("");

  // Document upload state
  const [showUpload, setShowUpload]   = useState(false);
  const [docType, setDocType]         = useState("cv");
  const [docFile, setDocFile]         = useState<File | null>(null);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: candidate, isLoading } = useQuery<CandidateWithApps>({
    queryKey: ["candidate", id],
    queryFn:  () => api.get<CandidateWithApps>(`/candidates/${id}`),
  });

  const { data: documents = [] } = useQuery<CandidateDocument[]>({
    queryKey: ["candidate-docs", id],
    queryFn:  () => api.get<CandidateDocument[]>(`/candidates/${id}/documents`)
      .then((r) => (r as unknown as { data?: CandidateDocument[] }).data ?? (r as unknown as CandidateDocument[])),
  });

  const { data: notes = [], error: notesError, refetch: refetchNotes } = useQuery<CandidateNote[]>({
    queryKey: ["candidate-notes", id],
    queryFn:  () => api.get<CandidateNote[]>(`/candidates/${id}/notes`),
    enabled:  !!id,
    refetchOnMount: true,
    staleTime: 0,
  });

  const [noteBody, setNoteBody]         = useState("");
  const [noteSubmitting, setNoteSubmitting] = useState(false);
  const [noteError, setNoteError]       = useState("");

  async function submitNote() {
    if (!noteBody.trim()) return;
    setNoteSubmitting(true); setNoteError("");
    try {
      await api.post(`/candidates/${id}/notes`, { body: noteBody.trim() });
      setNoteBody("");
      queryClient.invalidateQueries({ queryKey: ["candidate-notes", id] });
    } catch (e: any) {
      setNoteError(e?.response?.data?.error ?? "Failed to save note");
    } finally { setNoteSubmitting(false); }
  }

  const deleteNote = useMutation({
    mutationFn: (noteId: string) => api.delete(`/candidates/${id}/notes/${noteId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["candidate-notes", id] }),
  });

  const updateCandidate = useMutation({
    mutationFn: (body: Partial<Candidate>) => api.put<Candidate>(`/candidates/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["candidate", id] });
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
      setEditing(false);
      setSaveError("");
    },
    onError: (err: Error) => setSaveError(err.message),
  });

  const deleteDoc = useMutation({
    mutationFn: (docId: string) => api.delete(`/candidates/${id}/documents/${docId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["candidate-docs", id] }),
  });

  function startEdit() {
    if (!candidate) return;
    const ext = candidate as unknown as {
      sr_no?: string; date_referred?: string; suburb?: string;
      car?: string; police_check?: string; wwc?: string;
      industry_preference?: string[]; consultant_id?: string; comments?: string;
    };
    // Split name into first/last
    const nameParts = (candidate.name ?? "").split(" ");
    const first_name = nameParts[0] ?? "";
    const last_name  = nameParts.slice(1).join(" ");

    setEditForm({
      ...EMPTY_FORM,
      first_name,
      last_name,
      email:               candidate.email ?? "",
      phone:               candidate.phone ?? "",
      postcode:            ext.suburb ? (candidate.postcode ?? "") : (candidate.postcode ?? ""),
      suburb:              ext.suburb ?? candidate.city ?? "",
      state:               candidate.state ?? "",
      provider_id:         candidate.provider_id ?? "",
      consultant_id:       ext.consultant_id ?? "",
      benchmark_hours:     candidate.benchmark_hours ? String(candidate.benchmark_hours) : "",
      work_status:         candidate.work_status ?? "job_seeking",
      wage_subsidy:        candidate.wage_subsidy ?? false,
      wage_subsidy_amount: candidate.wage_subsidy_amount ? String(candidate.wage_subsidy_amount) : "",
      car:                 (ext.car as "yes"|"no"|"") ?? "",
      police_check:        (ext.police_check as "yes"|"no"|"") ?? "",
      wwc:                 (ext.wwc as "yes"|"no"|"") ?? "",
      industry_preference: ext.industry_preference ?? [],
      comments:            ext.comments ?? candidate.notes ?? "",
      date_referred:       ext.date_referred ? ext.date_referred.slice(0, 10) : "",
      training_ids:        [],   // trainings managed via Training tab
    });
    setSaveError("");
    setEditing(true);
  }

  function handleSave() {
    const fullName = [editForm.first_name, editForm.last_name].filter(Boolean).join(" ");
    if (!fullName.trim()) { setSaveError("First name is required."); return; }
    if (!editForm.phone)   { setSaveError("Phone is required."); return; }
    if (!/^\d{10}$/.test(editForm.phone.replace(/\s/g, ""))) {
      setSaveError("Phone must be 10 digits."); return;
    }
    updateCandidate.mutate({
      name:                fullName,
      email:               editForm.email,
      phone:               editForm.phone,
      city:                editForm.suburb,
      state:               editForm.state,
      postcode:            editForm.postcode,
      provider_id:         editForm.provider_id || null,
      benchmark_hours:     editForm.benchmark_hours ? Number(editForm.benchmark_hours) : undefined,
      work_status:         editForm.work_status as CandidateWorkStatus,
      wage_subsidy:        editForm.wage_subsidy,
      wage_subsidy_amount: editForm.wage_subsidy && editForm.wage_subsidy_amount
        ? Number(editForm.wage_subsidy_amount) : undefined,
      notes:               editForm.comments,
      // New fields
      suburb:              editForm.suburb,
      car:                 editForm.car,
      police_check:        editForm.police_check,
      wwc:                 editForm.wwc,
      industry_preference: editForm.industry_preference,
      consultant_id:       editForm.consultant_id || null,
      comments:            editForm.comments,
      date_referred:       editForm.date_referred || null,
    } as unknown as Partial<Candidate>);
  }

  async function handleDocUpload() {
    if (!docFile) { setUploadError("Please select a file."); return; }
    setUploadError("");
    const formData = new FormData();
    formData.append("file", docFile);
    formData.append("document_type", docType);

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${BASE_URL}/api/candidates/${id}/documents`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Upload failed");
      queryClient.invalidateQueries({ queryKey: ["candidate-docs", id] });
      setShowUpload(false);
      setDocFile(null);
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    }
  }

  if (isLoading) return <p className="p-6 text-slate-500">Loading...</p>;
  if (!candidate) return <p className="p-6 text-red-500">Candidate not found.</p>;

  const initials = candidate.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  // Typed access to new fields not yet in the Candidate type definition
  const ext = candidate as unknown as {
    sr_no?: string; date_referred?: string; suburb?: string; postcode?: string;
    car?: string; police_check?: string; wwc?: string;
    industry_preference?: string[]; consultant_name?: string; comments?: string;
  };

  const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
    job_seeking: { label: "Job Seeking", bg: "bg-blue-100",   text: "text-blue-700"   },
    employed:    { label: "Employed",    bg: "bg-green-100",  text: "text-green-700"  },
    placed:      { label: "Placed",      bg: "bg-purple-100", text: "text-purple-700" },
    inactive:    { label: "Inactive",    bg: "bg-slate-100",  text: "text-slate-600"  },
  };
  const statusCfg = statusConfig[candidate.work_status ?? ""] ?? { label: candidate.work_status ?? "", bg: "bg-slate-100", text: "text-slate-600" };

  const tabs = [
    { key: "overview",   label: "Overview"   },
    { key: "training",   label: "Training Program"   },
  ] as const;

  // ── When editing: full-page light layout (same look as Create Candidate) ──
  if (editing) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <button onClick={() => setEditing(false)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2 hover:bg-slate-50 shadow-sm transition mb-5">
            <ArrowLeft size={14} /> Back to {candidate.name}
          </button>
          <h1 className="text-3xl font-semibold text-slate-900 tracking-tight mb-6">Edit Candidate</h1>
          <CandidateFormPanel
            form={editForm}
            setForm={setEditForm}
            mode="edit"
            error={saveError}
            isSubmitting={updateCandidate.isPending}
            onSubmit={handleSave}
            onCancel={() => setEditing(false)}
            submitLabel={updateCandidate.isPending ? "Saving..." : "Save Changes"}
            showResumeUpload={false}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F1F5F9] p-4 sm:p-6">
      <div className="max-w-[1600px] mx-auto border border-slate-200 rounded-2xl shadow-sm bg-[#F8FAFC] overflow-hidden flex flex-col">

      {/* ═══════════════════════════════════════════════════════
          HEADER — Candidate Workspace
      ═══════════════════════════════════════════════════════ */}
      <div
        style={{ background: '#FFF7ED', borderBottom: '3px solid #e88e2e' }}
        className="flex-shrink-0"
      >
        <div className="max-w-[1600px] mx-auto px-6">

          {/* Back */}
          <div className="pt-4 pb-1">
            <Link to="/candidates"
              className="inline-flex items-center gap-2 text-xs font-medium text-[#e88e2e] border border-[#e88e2e] hover:bg-orange-50 rounded-lg px-3 py-1.5 transition-colors">
              <ArrowLeft size={12} /> All Candidates
            </Link>
          </div>

          {/* Candidate Identity */}
          <div className="flex items-start gap-4 pt-2 pb-2">
            {/* Avatar */}
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#e88e2e] to-[#b8711a] flex items-center justify-center text-lg font-bold text-white shadow-md flex-shrink-0">
              {initials}
            </div>

            {/* Name + meta */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1.5">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight leading-none">{candidate.name}</h1>
                {ext.sr_no && (
                  <span className="text-[11px] font-mono text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded">
                    #{ext.sr_no}
                  </span>
                )}
                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${statusCfg.bg} ${statusCfg.text}`}>
                  {statusCfg.label}
                </span>
              </div>

              {/* Pipe-separated metadata */}
              <div className="flex items-center flex-wrap divide-x divide-orange-200">
                <span className="flex items-center gap-1.5 text-xs text-slate-600 pr-3">
                  <Mail size={11} className="text-orange-400 flex-shrink-0" />{displayEmail(candidate.email)}
                </span>
                {candidate.phone && (
                  <span className="flex items-center gap-1.5 text-xs text-slate-600 px-3">
                    <Phone size={11} className="text-orange-400 flex-shrink-0" />{candidate.phone}
                  </span>
                )}
                {(ext.suburb || candidate.city || candidate.state) && (
                  <span className="flex items-center gap-1.5 text-xs text-slate-600 px-3">
                    <MapPin size={11} className="text-orange-400 flex-shrink-0" />
                    {[ext.suburb || candidate.city, candidate.state].filter(Boolean).join(", ")}
                  </span>
                )}
                {candidate.provider_name && (
                  <span className="flex items-center gap-1.5 text-xs text-slate-600 px-3">
                    <Building2 size={11} className="text-orange-400 flex-shrink-0" />{candidate.provider_name}
                  </span>
                )}
                {ext.date_referred && (
                  <span className="flex items-center gap-1.5 text-xs text-slate-600 px-3">
                    <Calendar size={11} className="text-orange-400 flex-shrink-0" />
                    Referred {fmtDate(ext.date_referred)}
                  </span>
                )}
              </div>
            </div>

            {/* Edit */}
            {canWrite && (
              <button onClick={startEdit}
                className="flex items-center gap-2 text-xs font-medium text-white bg-[#e88e2e] hover:bg-[#d07d20] rounded-lg px-3 py-1.5 transition-colors flex-shrink-0">
                <Edit2 size={12} /> Edit
              </button>
            )}
          </div>

          {/* Tab Nav */}
          {!editing && (
            <div className="flex">
              {tabs.map((t) => (
                <button key={t.key} onClick={() => setActiveTab(t.key)}
                  className={`px-5 py-2 text-sm font-medium transition-all border-b-2 -mb-px ${
                    activeTab === t.key
                      ? "border-[#e88e2e] text-[#e88e2e]"
                      : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          TAB CONTENT
      ═══════════════════════════════════════════════════════ */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="max-w-[1600px] mx-auto px-6 py-3">

          {/* ══ OVERVIEW ══════════════════════════════════════ */}
          {activeTab === "overview" && (
            <div className="grid grid-cols-1 lg:grid-cols-10 gap-4" style={{height: 'calc(100vh - 160px)'}}>

              {/* ── Left 70% ──────────────────────────── */}
              <div className="lg:col-span-7 flex flex-col gap-3">

                {/* Candidate Details — unified card with internal sections */}
                <div className="bg-white border border-slate-200 rounded-2xl" style={{boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 8px 24px rgba(15,23,42,0.07)'}}>

                  <div className="px-6 py-2 bg-orange-50 border-b border-orange-100 rounded-t-2xl">
                    <h2 className="text-sm font-semibold text-orange-900">Candidate Details</h2>
                  </div>

                  {/* Contact */}
                  <div className="px-6 py-3">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Contact Information</p>
                    <div className="grid grid-cols-3 gap-x-8 gap-y-3">
                      <div>
                        <p className="text-xs font-medium text-slate-400 mb-0.5">Email Address</p>
                        <p className="text-sm font-semibold text-slate-900 truncate">{displayEmail(candidate.email)}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-400 mb-0.5">Phone Number</p>
                        <p className="text-sm font-semibold text-slate-900">{candidate.phone || "—"}</p>
                      </div>
                    </div>
                  </div>

                  {/* Location */}
                  <div className="border-t border-slate-200/60 px-6 py-3">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Location</p>
                    <div className="grid grid-cols-3 gap-x-8 gap-y-3">
                      <div>
                        <p className="text-xs font-medium text-slate-400 mb-0.5">Suburb</p>
                        <p className="text-sm font-semibold text-slate-900">{ext.suburb || candidate.city || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-400 mb-0.5">State</p>
                        <p className="text-sm font-semibold text-slate-900">{candidate.state || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-400 mb-0.5">Postcode</p>
                        <p className="text-sm font-semibold text-slate-900">{ext.postcode || candidate.postcode || "—"}</p>
                      </div>
                    </div>
                  </div>

                  {/* Provider & Consultant */}
                  <div className="border-t border-slate-200/60 px-6 py-3">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Provider &amp; Consultant</p>
                    <div className="grid grid-cols-3 gap-x-8 gap-y-3">
                      <div>
                        <p className="text-xs font-medium text-slate-400 mb-0.5">Organisation</p>
                        {candidate.provider_id ? (
                          <Link to={`/providers/${candidate.provider_id}`}
                            className="text-sm font-semibold text-[#e88e2e] hover:text-[#c97a20] hover:underline transition-colors truncate block">
                            {candidate.provider_name || "View Provider"}
                          </Link>
                        ) : (
                          <p className="text-sm text-slate-400">Not assigned</p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-400 mb-0.5">Consultant</p>
                        <p className="text-sm font-semibold text-slate-900">{ext.consultant_name || "—"}</p>
                      </div>
                    </div>
                  </div>

                  {/* Work Details */}
                  <div className="border-t border-slate-200/60 px-6 py-3 bg-slate-50/40 rounded-b-2xl">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Work Details</p>
                    <div className="grid grid-cols-3 gap-x-8 gap-y-3">
                      <div>
                        <p className="text-xs font-medium text-slate-400 mb-0.5">Work Status</p>
                        <span className={`inline-flex w-fit text-xs font-semibold px-2.5 py-0.5 rounded-full ${statusCfg.bg} ${statusCfg.text}`}>
                          {statusCfg.label}
                        </span>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-400 mb-0.5">Benchmark Hours</p>
                        <p className="text-sm font-bold text-slate-900">
                          {candidate.benchmark_hours ? `${candidate.benchmark_hours} hrs / wk` : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-400 mb-0.5">Wage Subsidy</p>
                        {candidate.wage_subsidy ? (
                          <div className="flex items-center gap-1.5 text-green-700">
                            <CheckCircle size={12} />
                            <span className="text-sm font-semibold">
                              Eligible{candidate.wage_subsidy_amount
                                ? ` · $${Number(candidate.wage_subsidy_amount).toLocaleString()}`
                                : ""}
                            </span>
                          </div>
                        ) : (
                          <p className="text-sm text-slate-400">Not eligible</p>
                        )}
                      </div>
                    </div>
                  </div>

                </div>

                {/* ── Xero-style Communication Notes ── */}
                <div className="flex-shrink-0 bg-white border border-slate-200 rounded-2xl overflow-hidden" style={{boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 4px 12px rgba(15,23,42,0.05)'}}>
                  {/* Header */}
                  <div className="flex items-center justify-between px-5 py-3 bg-amber-50 border-b border-amber-100 rounded-t-2xl">
                    <div>
                      <h2 className="text-sm font-semibold text-amber-900">Communication Notes</h2>
                      <p className="text-xs text-amber-700/70 mt-0.5">{notes.length} {notes.length === 1 ? "note" : "notes"} logged</p>
                    </div>
                    <button onClick={() => refetchNotes()} className="text-xs text-amber-700/60 hover:text-amber-900 border border-amber-200 rounded-lg px-2 py-0.5 transition-colors">↻</button>
                  </div>

                  {/* Error state */}
                  {notesError && (
                    <div className="px-5 py-2 bg-red-50 border-b border-red-100 text-xs text-red-600">
                      Failed to load notes — <button onClick={() => refetchNotes()} className="underline font-semibold">Retry</button>
                    </div>
                  )}

                  {/* Compose box */}
                  {canWrite && (
                    <div className="px-5 py-3 bg-amber-50/40 border-b border-amber-100">
                      <textarea
                        value={noteBody}
                        onChange={(e) => setNoteBody(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitNote(); }}
                        placeholder="Add a communication note… (Ctrl+Enter to save)"
                        rows={2}
                        className="w-full text-sm text-slate-800 bg-white border border-amber-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 placeholder:text-slate-400 transition"
                      />
                      {noteError && <p className="text-xs text-red-500 mt-1">{noteError}</p>}
                      <div className="flex justify-end mt-2">
                        <button
                          onClick={submitNote}
                          disabled={noteSubmitting || !noteBody.trim()}
                          className="text-xs font-semibold text-white bg-[#e88e2e] hover:bg-[#d07d20] disabled:opacity-40 disabled:cursor-not-allowed rounded-lg px-4 py-1.5 transition-colors"
                        >
                          {noteSubmitting ? "Saving…" : "Add Note"}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Notes timeline */}
                  <div className="divide-y divide-slate-50 max-h-64 overflow-y-auto">
                    {notes.length === 0 ? (
                      <div className="flex items-center gap-2 px-5 py-3 text-slate-400">
                        <svg className="w-4 h-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 8h10M7 12h6m-6 4h10M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" />
                        </svg>
                        <span className="text-xs">No notes yet{canWrite ? " — add one above" : ""}</span>
                      </div>
                    ) : (
                      notes.map((note) => {
                        const initials   = note.author_name ? note.author_name.split(" ").slice(0,2).map((w:string) => w[0]).join("").toUpperCase() : "?";
                        const colours    = ["bg-violet-500","bg-blue-500","bg-emerald-500","bg-amber-500","bg-pink-500","bg-cyan-500"];
                        const avatarBg   = colours[note.author_id.charCodeAt(0) % colours.length];
                        const noteDate   = new Date(note.created_at);
                        const dateStr    = noteDate.toLocaleDateString("en-AU", { day:"numeric", month:"short", year:"numeric" });
                        const timeStr    = noteDate.toLocaleTimeString("en-AU", { hour:"2-digit", minute:"2-digit" });
                        return (
                          <div key={note.id} className="flex gap-3 px-5 py-3 hover:bg-slate-50/60 transition-colors group">
                            <div className={`w-7 h-7 rounded-full ${avatarBg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                              <span className="text-[10px] font-bold text-white">{initials}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                                <span className="text-xs font-semibold text-slate-900">{note.author_name}</span>
                                <span className="text-[10px] text-slate-400">·</span>
                                <span className="text-[10px] text-slate-400">{dateStr}</span>
                                <span className="text-[10px] text-slate-400">{timeStr}</span>
                              </div>
                              <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">{note.body}</p>
                            </div>
                            {isAdmin && (
                              <button
                                onClick={() => { if (confirm("Delete this note?")) deleteNote.mutate(note.id); }}
                                className="opacity-0 group-hover:opacity-100 flex-shrink-0 text-slate-300 hover:text-red-500 transition-all mt-0.5"
                                title="Delete note"
                              >
                                <X size={12} />
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* ── Vacancies (inline) ─────────────────────────── */}
                <VacanciesTab
                  applications={candidate.applications ?? []}
                  candidateId={id ?? ""}
                  canWrite={canWrite}
                />

                {/* ── Application History — fills remaining height ── */}
                {(() => {
                  const realApps = candidate.applications ?? [];
                  const isDummy  = realApps.length === 0;
                  const displayApps = isDummy ? [
                    { id: "_d1", job_title: "Customer Service Officer", stage: "interview" as ApplicationStage, applied_at: "2026-05-20", score: 7, source: "provider" },
                    { id: "_d2", job_title: "Administration Assistant",  stage: "interview" as ApplicationStage, applied_at: "2026-04-15", score: 5, source: "manual"   },
                    { id: "_d3", job_title: "Retail Sales Associate",    stage: "applied"  as ApplicationStage, applied_at: "2026-03-10", score: 0, source: "job_board" },
                  ] : realApps;
                  return (
                    <div className="flex-1 min-h-0 bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col" style={{boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 6px 18px rgba(15,23,42,0.07)'}}>
                      {/* card header */}
                      <div className="flex items-center justify-between px-5 py-2 bg-sky-50 border-b border-sky-100 flex-shrink-0">
                        <h3 className="text-sm font-semibold text-sky-900">
                          Application History
                          {!isDummy && <span className="ml-1.5 text-xs font-normal text-sky-500">({realApps.length})</span>}
                        </h3>
                        {isDummy && (
                          <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-medium">Sample preview</span>
                        )}
                      </div>
                      {/* notice banner for dummy mode */}
                      {isDummy && (
                        <div className="px-5 py-1.5 bg-amber-50/60 border-b border-amber-100 flex-shrink-0">
                          <p className="text-[10px] text-amber-700">Applications will appear here once this candidate applies to a vacancy.</p>
                        </div>
                      )}
                      {/* scrollable row list */}
                      <div className="flex-1 overflow-auto divide-y divide-slate-100">
                        {displayApps.map((app) => (
                          <div key={app.id} className={`flex items-center justify-between px-5 py-2.5 hover:bg-blue-50/20 transition-colors ${isDummy ? "opacity-40" : ""}` }>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-slate-900 truncate">{app.job_title}</p>
                              <p className="text-xs text-slate-400 mt-0.5">
                                Applied {fmtDate(app.applied_at)}
                                {app.source && ` · ${app.source}`}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                              {(app.score ?? 0) > 0 && (
                                <span className="text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg px-2.5 py-1">{app.score}/10</span>
                              )}
                              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STAGE_BADGE[app.stage]}`}>
                                {stageLabel(app.stage)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* ── Right 30% ─────────────────────────── */}
              <div className="lg:col-span-3 flex flex-col gap-3">

                {/* Availability & Employment Support */}
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden" style={{boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 6px 18px rgba(15,23,42,0.07)'}}>
                  <div className="px-5 py-2.5 bg-blue-50 border-b border-blue-100">
                    <h3 className="text-sm font-semibold text-blue-900">Availability</h3>
                  </div>
                  <div className="px-5 py-3">
                    <div className="flex items-baseline gap-2 mb-1.5">
                      <span className="text-[26px] font-bold text-slate-900 tracking-tight leading-none">
                        {candidate.benchmark_hours ?? "—"}
                      </span>
                      <span className="text-xs text-slate-500 pb-0.5">hrs / week</span>
                    </div>
                    <span className={`inline-flex text-xs font-semibold px-2.5 py-0.5 rounded-full ${statusCfg.bg} ${statusCfg.text}`}>
                      {statusCfg.label}
                    </span>
                  </div>

                  {candidate.wage_subsidy && (
                    <div className="border-t border-slate-200/60 bg-slate-50/50 px-5 py-2.5">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Employment Support</p>
                      <div className="flex items-center gap-1.5 text-green-700 mb-1">
                        <CheckCircle size={12} />
                        <span className="text-xs font-semibold">Wage Subsidy Eligible</span>
                      </div>
                      {candidate.wage_subsidy_amount && (
                        <p className="text-lg font-bold text-slate-900 tracking-tight">
                          ${Number(candidate.wage_subsidy_amount).toLocaleString()}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Verification / Compliance */}
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden" style={{boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 6px 18px rgba(15,23,42,0.07)'}}>
                  <div className="px-5 py-2.5 bg-green-50 border-b border-green-100">
                    <h3 className="text-sm font-semibold text-green-900">Verification</h3>
                  </div>
                  <div className="px-4 py-2 divide-y divide-slate-100">
                    {([
                      { field: "car"          as const, label: "Vehicle Available",     Icon: Car    },
                      { field: "police_check" as const, label: "Police Check",           Icon: Shield },
                      { field: "wwc"          as const, label: "Working With Children",  Icon: Users  },
                    ]).map(({ field, label, Icon }) => {
                      const val = ext[field];
                      const isYes = val === "yes";
                      const isNo  = val === "no";
                      return (
                        <div key={field} className="flex items-center justify-between py-2">
                          <div className="flex items-center gap-2.5">
                            <Icon size={14} className={isYes ? "text-green-600" : isNo ? "text-red-500" : "text-slate-400"} />
                            <span className="text-sm font-medium text-slate-700">{label}</span>
                          </div>
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                            isYes ? "bg-green-100 text-green-800 ring-1 ring-green-300" :
                            isNo  ? "bg-red-100 text-red-700 ring-1 ring-red-300" :
                            "bg-slate-200/80 text-slate-500"
                          }`}>
                            {isYes ? "Verified" : isNo ? "Not Done" : "Unknown"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Industry Preferences */}
                {(ext.industry_preference ?? []).length > 0 && (
                  <div className="flex-shrink-0 bg-white border border-slate-200 rounded-2xl overflow-hidden" style={{boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.05)'}}>
                    <div className="px-5 py-2 bg-violet-50 border-b border-violet-100">
                      <h3 className="text-sm font-semibold text-violet-900">Industry Preferences</h3>
                    </div>
                    <div className="px-5 py-2 flex flex-wrap gap-1.5">
                      {(ext.industry_preference ?? []).map((ind) => (
                        <span key={ind}
                          className="text-xs font-semibold px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 transition-colors">
                          {ind}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Documents — fills remaining height */}
                <div className="flex-1 min-h-0 bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col" style={{boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 6px 18px rgba(15,23,42,0.07)'}}>
                  <div className="flex items-center justify-between px-5 py-2 bg-indigo-50 border-b border-indigo-100 flex-shrink-0">
                    <h3 className="text-sm font-semibold text-indigo-900">
                      Documents{documents.length > 0 && <span className="ml-1.5 text-xs font-normal text-indigo-500">({documents.length})</span>}
                    </h3>
                    {canWrite && (
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => { setDocType("cv"); setShowUpload(true); }}
                          className="flex items-center gap-1 text-xs font-semibold text-white bg-[#e88e2e] hover:bg-[#d07d20] rounded-lg px-2.5 py-1 transition-colors">
                          <Upload size={11} /> Resume
                        </button>
                        <button onClick={() => { setDocType("other"); setShowUpload(true); }}
                          className="flex items-center gap-1 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg px-2.5 py-1 hover:bg-slate-50 transition-colors">
                          <Upload size={11} /> Document
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 overflow-auto">
                    {documents.length === 0 ? (
                      <div className="flex items-center gap-2.5 px-5 py-3 text-slate-400">
                        <FileText size={14} className="text-slate-300" />
                        <span className="text-xs">No documents uploaded yet{canWrite && " — upload using the buttons above"}.</span>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {documents.map((doc) => {
                          const mime     = (doc.mime_type ?? "").toLowerCase();
                          const isPdf    = mime.includes("pdf");
                          const isImg    = mime.startsWith("image/");
                          const isWord   = mime.includes("word") || mime.includes("officedocument");
                          const iconBg   = isPdf ? "bg-red-50 text-red-500" : isImg ? "bg-sky-50 text-sky-500" : isWord ? "bg-indigo-50 text-indigo-500" : "bg-slate-100 text-slate-500";
                          const token       = localStorage.getItem("token") ?? "";
                          const viewUrl     = `${BASE_URL}/api/candidates/${id}/documents/${doc.id}/view?token=${token}`;
                          const downloadUrl = `${BASE_URL}/api/candidates/${id}/documents/${doc.id}/download?token=${token}`;
                          return (
                            <div key={doc.id} className="flex items-center gap-3 px-5 py-1.5 hover:bg-blue-50/30 transition-colors">
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBg}`}>
                                <FileText size={13} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-slate-900 truncate">{doc.file_name}</p>
                                <p className="text-[10px] text-slate-400">
                                  {fmtDate(doc.created_at)}
                                  {doc.file_size && ` · ${Math.round(doc.file_size / 1024)} KB`}
                                </p>
                              </div>
                              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${DOC_TYPE_BADGE[doc.document_type] ?? DOC_TYPE_BADGE.other}`}>
                                {DOC_TYPE_LABEL[doc.document_type] ?? doc.document_type}
                              </span>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <a href={viewUrl} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-[10px] font-medium text-slate-600 border border-slate-200 hover:border-slate-300 rounded-md px-2 py-0.5 transition-colors">
                                  <Eye size={10} /> View
                                </a>
                                <a href={downloadUrl} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-[10px] text-slate-500 border border-slate-200 rounded-md px-2 py-0.5 hover:bg-slate-50 transition-colors">
                                  <Download size={10} /> Download
                                </a>
                                {isAdmin && (
                                  <button onClick={() => { if (confirm("Delete this document?")) deleteDoc.mutate(doc.id); }}
                                    className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors">
                                    <Trash2 size={11} />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

          )}

          {/* ══ TRAINING ═════════════════════════════════════ */}
          {activeTab === "training" && id && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6" style={{boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 8px 24px rgba(15,23,42,0.07)'}}>
              <TrainingTab candidateId={id} canWrite={canWrite} candidateName={candidate?.name ?? ""} />
            </div>
          )}

        </div>
        </div>


      {/* ── Upload Dialog ──────────────────────────────────── */}
      {showUpload && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h2 className="text-base font-semibold text-slate-900 mb-4">
              {docType === "cv" ? "Upload Resume / CV" : "Upload Document"}
            </h2>
            {uploadError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-4">{uploadError}</p>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Document Type</label>
                <select value={docType} onChange={(e) => setDocType(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#e88e2e]/40 focus:border-[#e88e2e]">
                  <option value="cv">Resume / CV</option>
                  <option value="cover_letter">Cover Letter</option>
                  <option value="id">ID Document</option>
                  <option value="certificate">Certificate / Licence</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">File</label>
                <div onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 rounded-xl p-5 text-center cursor-pointer hover:border-[#e88e2e] hover:bg-orange-50/30 transition-colors">
                  {docFile ? (
                    <p className="text-sm font-medium text-slate-700">{docFile.name}</p>
                  ) : (
                    <>
                      <Upload size={20} className="text-slate-300 mx-auto mb-2" />
                      <p className="text-sm text-slate-500">Click to select file</p>
                      <p className="text-xs text-slate-400 mt-0.5">PDF, JPG, PNG, DOC — max 10 MB</p>
                    </>
                  )}
                </div>
                <input ref={fileInputRef} type="file" className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  onChange={(e) => setDocFile(e.target.files?.[0] ?? null)} />
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-5">
              <button onClick={() => { setShowUpload(false); setDocFile(null); setUploadError(""); }}
                className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">Cancel</button>
              <button onClick={handleDocUpload}
                className="px-4 py-2 text-sm font-semibold bg-[#e88e2e] text-white rounded-xl hover:bg-[#d07d20] transition-colors">
                Upload
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// VacanciesTab
// ──────────────────────────────────────────────────────────────────────────────
type AppWithDates = {
  id: string;
  job_id?: string;
  job_title?: string;
  stage: string;
  applied_at: string;
  interview_date?: string | null;
  ets_date?: string | null;
  placement_date?: string | null;
  source?: string;
  score?: number;
};



const STAGE_BADGE2: Record<string, string> = {
  applied:   "bg-blue-100 text-blue-700",
  screening: "bg-purple-100 text-purple-700",
  interview: "bg-amber-100 text-amber-700",
  ets:       "bg-orange-100 text-orange-700",
  hired:     "bg-green-100 text-green-700",
  rejected:  "bg-red-100 text-red-500",
};

function InlineDateCellDetail({
  appId,
  field,
  value,
  onSaved,
  validate,
  allowClear,
}: {
  appId: string;
  field: "interview_date" | "ets_date" | "placement_date";
  value?: string | null;
  onSaved: () => void;
  validate?: (newDate: string | null) => string | null;
  allowClear?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function clearValue() {
    setError(null);
    setSaving(true);
    try {
      await api.patch(`/applications/${appId}`, { [field]: null });
      onSaved();
    } catch (e: any) {
      setError(e?.response?.data?.error ?? e?.message ?? "Error");
    } finally { setSaving(false); }
  }

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newVal = e.target.value || null;
    setError(null);
    if (validate) {
      const err = validate(newVal);
      if (err) { setError(err); return; }
    }
    setSaving(true);
    try {
      await api.patch(`/applications/${appId}`, { [field]: newVal });
      onSaved();
    } catch (e: any) {
      setError(e?.response?.data?.error ?? e?.message ?? "Save failed");
    }
    finally { setSaving(false); setEditing(false); }
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-1">
        <input
          type="date"
          autoFocus
          defaultValue={value ?? ""}
          onBlur={() => { setEditing(false); setError(null); }}
          onChange={handleChange}
          className="border border-[#e88e2e] rounded-lg px-2 py-1 text-xs focus:outline-none w-36"
        />
        {error && <span className="text-[10px] text-red-500 leading-tight max-w-[150px]">{error}</span>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1">
        <button
          onClick={() => setEditing(true)}
          disabled={saving}
          className="group flex items-center gap-1 text-xs transition-colors hover:text-[#e88e2e] text-left"
        >
          {saving ? <span className="text-slate-400">Saving…</span>
            : value
              ? <><span className="font-medium text-slate-800">{fmtDate(value)}</span>
                  <Pencil size={9} className="ml-0.5 text-slate-300 group-hover:text-[#e88e2e] opacity-0 group-hover:opacity-100 transition-opacity" /></>
              : <span className="italic text-slate-300 group-hover:text-[#e88e2e]/60">+ set</span>}
        </button>
        {allowClear && value && !saving && (
          <button
            onClick={() => { if (confirm("Remove this placement date?")) clearValue(); }}
            className="text-slate-300 hover:text-red-500 transition-colors"
            title="Clear placement date"
          >
            <X size={10} />
          </button>
        )}
      </div>
      {error && <span className="text-[10px] text-red-500 leading-tight max-w-[150px]">{error}</span>}
    </div>
  );
}

export function VacanciesTab({
  applications,
  candidateId,
  canWrite,
}: {
  applications: AppWithDates[];
  candidateId: string;
  canWrite: boolean;
}) {
  const queryClient       = useQueryClient();
  const [adding, setAdding]         = useState(false);
  const [selectedJob, setSelectedJob] = useState("");

  const { data: openJobs = [] } = useQuery<{ id: string; title: string; job_number?: string }[]>({
    queryKey: ["jobs-open"],
    queryFn:  () => api.get<{ id: string; title: string; job_number?: string }[]>("/jobs?status=open&limit=200"),
  });

  const addToVacancy = useMutation({
    mutationFn: ({ job_id }: { job_id: string }) =>
      api.post("/applications", { job_id, candidate_id: candidateId, source: "manual" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["candidate", candidateId] });
      setAdding(false);
      setSelectedJob("");
    },
  });

  const updateStage = useMutation({
    mutationFn: ({ appId, stage }: { appId: string; stage: string }) =>
      api.patch(`/applications/${appId}`, { stage }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["candidate", candidateId] }),
  });

  const deleteApplication = useMutation({
    mutationFn: (appId: string) => api.delete(`/applications/${appId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["candidate", candidateId] }),
  });

  function handleAdd() {
    if (!selectedJob) return;
    addToVacancy.mutate({ job_id: selectedJob });
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden" style={{boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 8px 24px rgba(15,23,42,0.07)'}}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-b border-slate-200">
        <h3 className="text-sm font-semibold text-slate-900">
          Vacancies Applied
          <span className="ml-2 text-xs font-normal text-slate-400">({applications.length})</span>
        </h3>
        {canWrite && (
          <button
            onClick={() => setAdding((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-semibold bg-[#e88e2e] hover:bg-[#d07d20] text-white px-3 py-1.5 rounded-lg transition-colors"
          >
            + Add to Vacancy
          </button>
        )}
      </div>

      {/* Add to vacancy inline form */}
      {adding && (
        <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-100 bg-orange-50/40">
          <select
            value={selectedJob}
            onChange={(e) => setSelectedJob(e.target.value)}
            className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#e88e2e]/40 focus:border-[#e88e2e]"
          >
            <option value="">Select a vacancy…</option>
            {openJobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title}{j.job_number ? ` (#${j.job_number})` : ""}
              </option>
            ))}
          </select>
          <button
            onClick={handleAdd}
            disabled={!selectedJob || addToVacancy.isPending}
            className="px-4 py-2 text-sm font-semibold bg-[#e88e2e] text-white rounded-xl hover:bg-[#d07d20] disabled:opacity-40 transition-colors whitespace-nowrap"
          >
            {addToVacancy.isPending ? "Adding…" : "Add"}
          </button>
          <button
            onClick={() => { setAdding(false); setSelectedJob(""); }}
            className="px-3 py-2 text-sm text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Table */}
      {applications.length === 0 ? (
        <div className="py-10 text-center text-slate-400 text-sm">
          No vacancy applications yet{canWrite && " — use the button above to link one"}.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                {["Vacancy / Job","Status","Applied","Interview Date","ETS Date","Placement Date",""].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => (
                <tr key={app.id} className="border-b hover:bg-slate-50/60 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900 text-sm">{app.job_title ?? "(No title)"}</p>
                    {app.source && <p className="text-[10px] text-slate-400">{app.source}</p>}
                  </td>
                  <td className="px-4 py-3">
                    {canWrite ? (
                      <select
                        value={app.stage}
                        onChange={(e) => updateStage.mutate({ appId: app.id, stage: e.target.value })}
                        className={`text-xs font-semibold px-2.5 py-1 rounded-full border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#e88e2e]/40 ${STAGE_BADGE2[app.stage] ?? "bg-slate-100 text-slate-600"}`}
                      >
                        {((["applied","interview","ets","hired","rejected"] as const) as string[]).concat(app.stage === "screening" ? ["screening"] : []).map((s) => (
                          <option key={s} value={s}>{stageLabel(s)}{s === "screening" ? " (change me)" : ""}</option>
                        ))}
                      </select>
                    ) : (
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${STAGE_BADGE2[app.stage] ?? "bg-slate-100 text-slate-600"}`}>
                        {stageLabel(app.stage)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                    {fmtDate(app.applied_at)}
                  </td>
                  <td className="px-4 py-3">
                    {canWrite ? (
                      <InlineDateCellDetail
                        appId={app.id}
                        field="interview_date"
                        value={app.interview_date}
                        onSaved={() => queryClient.invalidateQueries({ queryKey: ["candidate", candidateId] })}
                      />
                    ) : (
                      <span className="text-xs text-slate-600">{fmtDate(app.interview_date)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {canWrite ? (
                      <InlineDateCellDetail
                        appId={app.id}
                        field="ets_date"
                        value={app.ets_date}
                        onSaved={() => queryClient.invalidateQueries({ queryKey: ["candidate", candidateId] })}
                        validate={(d) => {
                          if (!app.interview_date) return "Set Interview Date first";
                          if (d && app.interview_date && d < app.interview_date) return "ETS must be after Interview Date";
                          return null;
                        }}
                      />
                    ) : (
                      <span className="text-xs text-slate-600">{fmtDate(app.ets_date)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {canWrite ? (
                      <InlineDateCellDetail
                        appId={app.id}
                        field="placement_date"
                        value={app.placement_date}
                        onSaved={() => queryClient.invalidateQueries({ queryKey: ["candidate", candidateId] })}
                        allowClear
                        validate={(d) => {
                          if (!app.interview_date) return "Set Interview Date first";
                          if (!app.ets_date) return "Set ETS Date first";
                          if (d && app.ets_date && d < app.ets_date) return "Placement must be after ETS Date";
                          return null;
                        }}
                      />
                    ) : (
                      <span className="text-xs text-slate-600">{fmtDate(app.placement_date)}</span>
                    )}
                  </td>
                  {canWrite && (
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => { if (confirm(`Remove this vacancy application?`)) deleteApplication.mutate(app.id); }}
                        className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Remove application">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function TrainingTab({ candidateId, canWrite, candidateName }: { candidateId: string; canWrite: boolean; candidateName: string }) {
  const { data: rawEnrolments = [], isLoading } = useCandidateTrainings(candidateId);
  const enrolments = [...rawEnrolments].sort((a, b) => {
    const aVal = a.created_at ?? a.id ?? "";
    const bVal = b.created_at ?? b.id ?? "";
    return bVal > aVal ? 1 : bVal < aVal ? -1 : 0;
  });
  const [showDialog, setShowDialog] = useState(false);
  const [editingEnrolment, setEditingEnrolment] = useState<CandidateTraining | null>(null);
  const [invoicingEnrolment, setInvoicingEnrolment] = useState<CandidateTraining | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-slate-900 tracking-tight">
          Training history
          <span className="text-slate-400 font-normal ml-1">({enrolments.length})</span>
        </h2>
        {canWrite && (
          <button
            onClick={() => { setEditingEnrolment(null); setShowDialog(true); }}
            className="px-3 py-1.5 text-xs rounded-lg bg-[#e88e2e] text-white hover:bg-[#d07d20]"
          >
            + Enrol
          </button>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading...</p>
      ) : enrolments.length === 0 ? (
        <p className="text-sm text-slate-400">No training records.</p>
      ) : (
        <div className="overflow-hidden border border-slate-100 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="text-left px-4 py-2.5">Course</th>
                <th className="text-left px-4 py-2.5">Provider</th>
                <th className="text-left px-4 py-2.5">Status</th>
                <th className="text-left px-4 py-2.5">Start</th>
                <th className="text-left px-4 py-2.5">End</th>
                <th className="text-left px-4 py-2.5">Cert #</th>
                <th className="px-4 py-2.5"></th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {enrolments.map((e) => (
                <tr key={e.id}>
                  <td className="px-4 py-2.5 text-slate-900">
                    {e.training_name}
                    {e.training_code && <span className="text-xs text-slate-400 ml-1">({e.training_code})</span>}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">{e.provider_name || "—"}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs ${TRAINING_BADGE[e.status]}`}>
                      {e.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">{fmtDate(e.start_date)}</td>
                  <td className="px-4 py-2.5 text-slate-500">{fmtDate(e.end_date)}</td>
                  <td className="px-4 py-2.5 text-slate-500">{e.certificate_no ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right">
                    {canWrite && (
                      <button
                        onClick={() => { setEditingEnrolment(e); setShowDialog(true); }}
                        className="text-xs text-slate-500 hover:underline"
                      >
                        Edit
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <InvoiceCell enrolment={e} onGenerate={setInvoicingEnrolment} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showDialog && (
        <EnrolmentDialog
          candidateId={candidateId}
          enrolment={editingEnrolment}
          onClose={() => { setShowDialog(false); setEditingEnrolment(null); }}
        />
      )}

      {invoicingEnrolment && (
        <GenerateInvoiceDialog
          enrolment={invoicingEnrolment}
          candidateName={candidateName}
          defaultUnitPrice={null}
          onClose={() => setInvoicingEnrolment(null)}
          onSuccess={() => setInvoicingEnrolment(null)}
        />
      )}
    </div>
  );
}

function InvoiceCell({ enrolment, onGenerate }: { enrolment: CandidateTraining; onGenerate: (e: CandidateTraining) => void }) {
  const { data } = useXeroInvoicesForEnrolment(enrolment.id);
  const existing = data?.data?.[0];
  if (existing) {
    return (
      <a href={`https://invoicing.xero.com/edit/${existing.xero_invoice_id}`} target="_blank" rel="noreferrer"
         className="text-xs text-blue-600 hover:underline">
        View in Xero
      </a>
    );
  }
  return (
    <button onClick={() => onGenerate(enrolment)} className="text-xs text-slate-500 hover:underline">
      Generate invoice
    </button>
  );
}

function EnrolmentDialog({
  candidateId,
  enrolment,
  onClose,
}: { candidateId: string; enrolment: CandidateTraining | null; onClose: () => void }) {
  const { data: catalogue } = useTrainings({ isActive: true, limit: 200 });
  const trainings: Training[] = catalogue?.data ?? [];

  const [trainingId, setTrainingId] = useState(enrolment?.training_id ?? "");
  const [status, setStatus] = useState<TrainingStatus>(enrolment?.status ?? "enrolled");
  const [startDate, setStartDate] = useState(enrolment?.start_date ?? "");
  const [endDate, setEndDate] = useState(enrolment?.end_date ?? "");
  const [certificateNo, setCertificateNo] = useState(enrolment?.certificate_no ?? "");
  const [certificateReceived, setCertificateReceived] = useState<"yes"|"no"|"">(
    enrolment?.certificate_received === true ? "yes" : enrolment?.certificate_received === false ? "no" : ""
  );
  const [notes, setNotes] = useState(enrolment?.notes ?? "");
  const [error, setError] = useState("");

  const create = useCreateEnrolment();
  const update = useUpdateEnrolment();
  const remove = useDeleteEnrolment(candidateId);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!trainingId) { setError("Please pick a course."); return; }
    if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
      setError("End date must be on or after start date.");
      return;
    }

    const payload = {
      training_id: trainingId,
      status,
      start_date: startDate || null,
      end_date: endDate || null,
      certificate_no: certificateNo || null,
      certificate_received: status === "completed" ? (certificateReceived === "yes" ? true : certificateReceived === "no" ? false : null) : null,
      notes: notes || null,
    };

    const promise = enrolment
      ? update.mutateAsync({ id: enrolment.id, candidate_id: candidateId, body: payload })
      : create.mutateAsync({ candidate_id: candidateId, ...payload });
    promise.then(onClose).catch((err: Error) => setError(err.message));
  }

  function handleDelete() {
    if (!enrolment) return;
    if (!confirm("Remove this enrolment? This cannot be undone.")) return;
    remove.mutate(enrolment.id, { onSuccess: onClose });
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          {enrolment ? "Edit Enrolment" : "Enrol in Training"}
        </h2>
        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className="text-xs text-slate-500">Course *</label>
            <select
              value={trainingId}
              onChange={(e) => setTrainingId(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              disabled={!!enrolment}
            >
              <option value="">— Pick a course —</option>
              {trainings.map((t) => (
                <option key={t.id} value={t.id}>{t.name}{t.code ? ` (${t.code})` : ""}</option>
              ))}
            </select>
          </div>

          {/* Status — only shown when EDITING, hidden on new enrolment */}
          {enrolment && (
            <div>
              <label className="text-xs text-slate-500">Status</label>
              <select value={status} onChange={(e) => { setStatus(e.target.value as TrainingStatus); setCertificateReceived(""); }} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                <option value="enrolled">Enrolled</option>
                <option value="in_progress">In progress</option>
                <option value="completed">Completed</option>
                <option value="withdrawn">Withdrawn</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          )}

          {/* Start / End date — only shown on new enrolment, not on edit */}
          {!enrolment && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500">Start date</label>
                <input type="date" value={startDate ?? ""} onChange={(e) => setStartDate(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-slate-500">End date</label>
                <input type="date" value={endDate ?? ""} onChange={(e) => setEndDate(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
          )}

          {/* Certificate fields — only when status = completed */}
          {status === "completed" && (
            <>
              <div>
                <label className="text-xs text-slate-500 font-medium">Certificate Received?</label>
                <select
                  value={certificateReceived}
                  onChange={(e) => setCertificateReceived(e.target.value as "yes"|"no"|"")}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-0.5"
                >
                  <option value="">— Select —</option>
                  <option value="yes">Yes — certificate received</option>
                  <option value="no">No — not yet received</option>
                </select>
              </div>
              {certificateReceived === "yes" && (
                <div>
                  <label className="text-xs text-slate-500">Certificate #</label>
                  <input value={certificateNo ?? ""} onChange={(e) => setCertificateNo(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="e.g. CERT-2024-001" />
                </div>
              )}
            </>
          )}
          <div>
            <label className="text-xs text-slate-500">Notes</label>
            <textarea value={notes ?? ""} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex justify-between items-center pt-2">
            <div>
              {enrolment && (
                <button type="button" onClick={handleDelete} className="text-xs text-red-600 hover:underline">
                  Remove
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-slate-200 hover:bg-slate-50">Cancel</button>
              <button type="submit" disabled={create.isPending || update.isPending} className="px-4 py-2 text-sm rounded-lg bg-[#e88e2e] text-white hover:bg-[#d07d20] disabled:opacity-50">
                {enrolment ? "Save" : "Enrol"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
