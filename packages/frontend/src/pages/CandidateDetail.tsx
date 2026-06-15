import { useState, useRef } from "react";
import { displayEmail } from "../lib/utils";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Mail, Phone, MapPin, Edit2, Upload, Download, Trash2, FileText, Eye, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { api } from "../lib/api";
import { CandidateFormPanel, EMPTY_FORM } from "../components/CandidateFormPanel";
import type { CandidateFormData } from "../components/CandidateFormPanel";
import type { Candidate, ApplicationStage, CandidateDocument, CandidateWorkStatus, CandidateTraining, TrainingStatus, Training } from "../types";
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
  offer:     "border border-orange-400 text-orange-600 bg-transparent",
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

  const [activeTab, setActiveTab] = useState<"overview"|"documents"|"training"|"applications">("overview");
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
    { key: "overview",      label: "Overview"     },
    { key: "documents",     label: `Documents${documents.length ? ` (${documents.length})` : ""}` },
    { key: "training",      label: "Training"     },
    { key: "applications",  label: `Applications${candidate.applications?.length ? ` (${candidate.applications.length})` : ""}` },
  ] as const;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Hero Banner ─────────────────────────────────── */}
      <div className="bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] pt-6 pb-0">
        <div className="max-w-5xl mx-auto px-6">
          {/* Back link */}
          <Link to="/candidates"
            className="inline-flex items-center gap-1.5 text-sm text-white/70 hover:text-white transition mb-5">
            <ArrowLeft size={14} /> Back to Candidates
          </Link>

          {editing ? (
            /* ── Edit Form — uses the same shared panel as Create ── */
            <div className="bg-slate-50 rounded-2xl shadow-xl p-6 mb-6 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-900">Edit Candidate</h2>
                <button onClick={() => setEditing(false)} className="text-slate-400 hover:text-slate-600 transition">
                  <ExternalLink size={0} className="hidden" />
                  ✕
                </button>
              </div>
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

          ) : (
            /* ── Hero Profile ─────────────────────────── */
            <div className="flex items-end gap-6 pb-6">
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-[#e88e2e] to-[#f5a623] flex items-center justify-center text-3xl font-black text-white shadow-lg">
                  {initials}
                </div>
                {ext.sr_no && (
                  <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-[10px] bg-white text-slate-500 font-mono px-2 py-0.5 rounded-full shadow border border-slate-100 whitespace-nowrap">
                    {ext.sr_no}
                  </span>
                )}
              </div>

              {/* Name block */}
              <div className="flex-1 min-w-0 mb-1">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h1 className="text-2xl font-black text-white tracking-tight leading-tight">{candidate.name}</h1>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className={`text-xs font-semibold px-3 py-1 rounded-full ${statusCfg.bg} ${statusCfg.text}`}>
                        {statusCfg.label}
                      </span>
                      {ext.date_referred && (
                        <span className="text-xs text-white/60">
                          Referred {format(new Date(ext.date_referred), "dd MMM yyyy")}
                        </span>
                      )}
                      {candidate.provider_name && (
                        <span className="text-xs text-white/60">· {candidate.provider_name}</span>
                      )}
                    </div>
                    {/* Contact pills */}
                    <div className="flex flex-wrap gap-3 mt-3">
                      <span className="flex items-center gap-1.5 text-xs text-white/80"><Mail size={12} />{displayEmail(candidate.email)}</span>
                      {candidate.phone && <span className="flex items-center gap-1.5 text-xs text-white/80"><Phone size={12} />{candidate.phone}</span>}
                      {(ext.suburb || candidate.state) && (
                        <span className="flex items-center gap-1.5 text-xs text-white/80">
                          <MapPin size={12} />
                          {[ext.suburb || candidate.city, candidate.state, ext.postcode || candidate.postcode].filter(Boolean).join(", ")}
                        </span>
                      )}
                    </div>
                  </div>
                  {canWrite && (
                    <button onClick={startEdit}
                      className="flex items-center gap-1.5 text-xs text-white border border-white/30 bg-white/10 hover:bg-white/20 rounded-xl px-3 py-2 transition flex-shrink-0">
                      <Edit2 size={12} /> Edit
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Tabs ──────────────────────────────────── */}
          {!editing && (
            <div className="flex gap-1 mt-2">
              {tabs.map((t) => (
                <button key={t.key} onClick={() => setActiveTab(t.key)}
                  className={`px-4 py-2.5 text-sm font-medium rounded-t-xl transition ${
                    activeTab === t.key
                      ? "bg-slate-50 text-[#e88e2e]"
                      : "text-white/60 hover:text-white/90"
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Tab Content ─────────────────────────────── */}
      {!editing && (
        <div className="max-w-5xl mx-auto px-6 py-6 space-y-4">

          {/* ══ OVERVIEW TAB ══════════════════════════ */}
          {activeTab === "overview" && (
            <>
              {/* Info grid */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">

                {/* Contact card */}
                <div className="bg-white rounded-2xl shadow-sm p-5 lg:col-span-2">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Contact Info</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-slate-400 mb-0.5">Email</p>
                      <p className="font-medium text-slate-800 truncate">{displayEmail(candidate.email)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 mb-0.5">Phone</p>
                      <p className="font-medium text-slate-800">{candidate.phone || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 mb-0.5">Suburb</p>
                      <p className="font-medium text-slate-800">{ext.suburb || candidate.city || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 mb-0.5">State / Postcode</p>
                      <p className="font-medium text-slate-800">{[candidate.state, ext.postcode || candidate.postcode].filter(Boolean).join(" ") || "—"}</p>
                    </div>
                  </div>
                </div>

                {/* Benchmark card */}
                <div className="bg-gradient-to-br from-[#e88e2e] to-[#f5a623] rounded-2xl shadow-sm p-5 text-white">
                  <p className="text-xs font-bold uppercase tracking-widest text-white/70 mb-1">Benchmark</p>
                  <p className="text-4xl font-black">{candidate.benchmark_hours ?? "—"}</p>
                  <p className="text-sm text-white/80 mt-0.5">hours / week</p>
                  {candidate.wage_subsidy && (
                    <div className="mt-3 bg-white/20 rounded-xl px-3 py-1.5 text-xs font-medium">
                      💰 Wage Subsidy{candidate.wage_subsidy_amount ? `: $${Number(candidate.wage_subsidy_amount).toLocaleString()}` : ""}
                    </div>
                  )}
                </div>

                {/* Provider/Consultant card */}
                <div className="bg-white rounded-2xl shadow-sm p-5">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Provider</h3>
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="text-xs text-slate-400 mb-0.5">Organisation</p>
                      {candidate.provider_id ? (
                        <Link to={`/providers/${candidate.provider_id}`}
                          className="font-semibold text-[#e88e2e] hover:underline">
                          {candidate.provider_name || "View"}
                        </Link>
                      ) : <p className="text-slate-400">Not assigned</p>}
                    </div>
                    {ext.consultant_name && (
                      <div>
                        <p className="text-xs text-slate-400 mb-0.5">Consultant</p>
                        <p className="font-medium text-slate-800">{ext.consultant_name}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Compliance card */}
                <div className="bg-white rounded-2xl shadow-sm p-5">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Compliance</h3>
                  <div className="space-y-2.5">
                    {([
                      { field: "car" as const,          label: "🚗 Car Available" },
                      { field: "police_check" as const, label: "🔍 Police Check" },
                      { field: "wwc" as const,          label: "👶 WWC Check"    },
                    ]).map(({ field, label }) => {
                      const val = ext[field];
                      return (
                        <div key={field} className="flex items-center justify-between">
                          <span className="text-sm text-slate-600">{label}</span>
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                            val === "yes" ? "bg-green-100 text-green-700" :
                            val === "no"  ? "bg-red-50 text-red-500" :
                            "bg-slate-100 text-slate-400"
                          }`}>
                            {val === "yes" ? "✓ Yes" : val === "no" ? "✗ No" : "—"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Industry Preference */}
                {(ext.industry_preference ?? []).length > 0 && (
                  <div className="bg-white rounded-2xl shadow-sm p-5">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Industry Preference</h3>
                    <div className="flex flex-wrap gap-2">
                      {(ext.industry_preference ?? []).map((ind) => (
                        <span key={ind} className="text-xs font-medium px-3 py-1.5 rounded-xl bg-orange-50 text-[#e88e2e] border border-orange-100">
                          {ind}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Comments */}
              {(ext.comments || candidate.notes) && (
                <div className="bg-white rounded-2xl shadow-sm p-5">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Comments / Notes</h3>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{ext.comments || candidate.notes}</p>
                </div>
              )}
            </>
          )}

          {/* ══ DOCUMENTS TAB ═════════════════════════ */}
          {activeTab === "documents" && (
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-slate-900">Documents</h3>
                {canWrite && (
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setDocType("cv"); setShowUpload(true); }}
                      className="flex items-center gap-1.5 text-xs font-medium text-white bg-[#e88e2e] hover:bg-[#d07d20] rounded-xl px-3 py-2 transition">
                      <Upload size={12} /> Upload Resume
                    </button>
                    <button onClick={() => { setDocType("other"); setShowUpload(true); }}
                      className="flex items-center gap-1.5 text-xs text-slate-600 border border-slate-200 rounded-xl px-3 py-2 hover:bg-slate-50 transition">
                      <Upload size={12} /> Upload Document
                    </button>
                  </div>
                )}
              </div>
              {documents.length === 0 ? (
                <div className="text-center py-12">
                  <FileText size={40} className="text-slate-200 mx-auto mb-3" />
                  <p className="text-slate-400 text-sm">No documents uploaded yet</p>
                  {canWrite && <p className="text-xs text-slate-300 mt-1">Click "Upload Resume" to add the first one</p>}
                </div>
              ) : (
                <div className="space-y-2">
                  {documents.map((doc) => {
                    const mime = (doc.mime_type ?? "").toLowerCase();
                    const isPdf = mime.includes("pdf");
                    const isImage = mime.startsWith("image/");
                    const isWord = mime.includes("word") || mime.includes("officedocument");
                    const iconBg = isPdf ? "bg-red-50 text-red-500" : isImage ? "bg-blue-50 text-blue-500" : isWord ? "bg-indigo-50 text-indigo-500" : "bg-slate-50 text-slate-400";
                    const viewUrl = `${BASE_URL}/api/candidates/${id}/documents/${doc.id}/view`;
                    const downloadUrl = `${BASE_URL}/api/candidates/${id}/documents/${doc.id}/download`;
                    return (
                      <div key={doc.id} className="flex items-center gap-4 p-3 rounded-xl border border-slate-100 hover:border-orange-200 hover:bg-orange-50/30 transition group">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
                          <FileText size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">{doc.file_name}</p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {format(new Date(doc.created_at), "dd MMM yyyy")}
                            {doc.uploaded_by_name && ` · ${doc.uploaded_by_name}`}
                            {doc.file_size && ` · ${Math.round(doc.file_size / 1024)} KB`}
                          </p>
                        </div>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${DOC_TYPE_BADGE[doc.document_type] ?? DOC_TYPE_BADGE.other}`}>
                          {DOC_TYPE_LABEL[doc.document_type] ?? doc.document_type}
                        </span>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <a href={viewUrl} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs font-medium text-white bg-[#e88e2e] hover:bg-[#d07d20] rounded-lg px-2.5 py-1.5 transition">
                            <Eye size={11} /> View
                          </a>
                          <a href={downloadUrl} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-slate-500 border border-slate-200 rounded-lg px-2.5 py-1.5 hover:bg-slate-100 transition">
                            <Download size={11} /> Download
                          </a>
                          {isAdmin && (
                            <button onClick={() => { if (confirm("Delete this document?")) deleteDoc.mutate(doc.id); }}
                              className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ══ TRAINING TAB ══════════════════════════ */}
          {activeTab === "training" && id && (
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <TrainingTab candidateId={id} canWrite={canWrite} candidateName={candidate?.name ?? ""} />
            </div>
          )}

          {/* ══ APPLICATIONS TAB ══════════════════════ */}
          {activeTab === "applications" && (
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <h3 className="font-bold text-slate-900 mb-4">Application History</h3>
              {!candidate.applications?.length ? (
                <div className="text-center py-12">
                  <ExternalLink size={36} className="text-slate-200 mx-auto mb-3" />
                  <p className="text-slate-400 text-sm">No applications yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {candidate.applications.map((app) => (
                    <div key={app.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{app.job_title}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Applied {format(new Date(app.applied_at), "dd MMM yyyy")}
                          {app.source && ` · ${app.source}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {app.score > 0 && (
                          <span className="text-xs font-bold text-slate-500 bg-slate-100 rounded-lg px-2 py-1">{app.score}/10</span>
                        )}
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STAGE_BADGE[app.stage]}`}>{app.stage}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Upload Dialog ────────────────────────────── */}
      {showUpload && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">
              {docType === "cv" ? "Upload Resume / CV" : "Upload Document"}
            </h2>
            {uploadError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2 mb-3">{uploadError}</p>
            )}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Document Type</label>
                <select value={docType} onChange={(e) => setDocType(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="cv">Resume / CV</option>
                  <option value="cover_letter">Cover Letter</option>
                  <option value="id">ID Document</option>
                  <option value="certificate">Certificate / Licence</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">File</label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30">
                  {docFile ? (
                    <p className="text-sm text-slate-700">{docFile.name}</p>
                  ) : (
                    <p className="text-sm text-slate-400">Click to select file (PDF, JPG, PNG, DOC — max 10MB)</p>
                  )}
                </div>
                <input ref={fileInputRef} type="file" className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  onChange={(e) => setDocFile(e.target.files?.[0] ?? null)} />
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-4">
              <button onClick={() => { setShowUpload(false); setDocFile(null); setUploadError(""); }}
                className="px-4 py-2 text-sm text-slate-600 border rounded-lg hover:bg-slate-50">Cancel</button>
              <button onClick={handleDocUpload}
                className="px-4 py-2 text-sm bg-[#e88e2e] text-white rounded-lg hover:bg-[#d07d20]">
                Upload
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function TrainingTab({ candidateId, canWrite, candidateName }: { candidateId: string; canWrite: boolean; candidateName: string }) {
  const { data: enrolments = [], isLoading } = useCandidateTrainings(candidateId);
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
                  <td className="px-4 py-2.5 text-slate-500">{e.start_date ?? "—"}</td>
                  <td className="px-4 py-2.5 text-slate-500">{e.end_date ?? "—"}</td>
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
          <div>
            <label className="text-xs text-slate-500">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as TrainingStatus)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
              <option value="enrolled">Enrolled</option>
              <option value="in_progress">In progress</option>
              <option value="completed">Completed</option>
              <option value="withdrawn">Withdrawn</option>
              <option value="failed">Failed</option>
            </select>
          </div>
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
          {status === "completed" && (
            <div>
              <label className="text-xs text-slate-500">Certificate #</label>
              <input value={certificateNo ?? ""} onChange={(e) => setCertificateNo(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
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
