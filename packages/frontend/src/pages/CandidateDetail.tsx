import { useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Mail, Phone, MapPin, ExternalLink, Edit2, X, Check, Upload, Download, Trash2, FileText } from "lucide-react";
import { format } from "date-fns";
import { api } from "../lib/api";
import type { Candidate, ApplicationStage, CandidateDocument, Provider, CandidateWorkStatus } from "../types";
import { useAuth } from "../contexts/AuthContext";

const BASE_URL = import.meta.env.VITE_API_URL?.replace("/api", "") || "http://localhost:3001";

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

  const [editing, setEditing] = useState(false);
  const [form, setForm]       = useState<Partial<Candidate>>({});
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

  const { data: providersResult } = useQuery({
    queryKey: ["providers-select"],
    queryFn:  () => api.list<Provider>("/providers?limit=100"),
    enabled: isAdmin,
  });
  const providers = providersResult?.data ?? [];

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
    setForm({
      name:                candidate.name,
      email:               candidate.email,
      phone:               candidate.phone ?? "",
      city:                candidate.city ?? "",
      state:               candidate.state ?? "",
      resume_url:          candidate.resume_url ?? "",
      linkedin:            candidate.linkedin ?? "",
      notes:               candidate.notes ?? "",
      address_line1:       candidate.address_line1 ?? "",
      address_line2:       candidate.address_line2 ?? "",
      postcode:            candidate.postcode ?? "",
      country:             candidate.country ?? "Australia",
      benchmark_hours:     candidate.benchmark_hours ?? undefined,
      work_status:         candidate.work_status ?? "job_seeking",
      interested_job:      candidate.interested_job ?? "",
      provider_id:         candidate.provider_id ?? "",
      wage_subsidy:        candidate.wage_subsidy ?? false,
      wage_subsidy_amount: candidate.wage_subsidy_amount ?? undefined,
    });
    setSaveError("");
    setEditing(true);
  }

  function handleSave() {
    if (!form.name?.trim() || !form.email?.trim()) {
      setSaveError("Name and email are required.");
      return;
    }
    updateCandidate.mutate(form);
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

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Link to="/candidates" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-4">
        <ArrowLeft size={15} /> Back to Candidates
      </Link>

      {/* Profile card */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
        {editing ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold text-slate-900 tracking-tight">Edit Candidate</h2>
              <button onClick={() => setEditing(false)} className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>
            {saveError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{saveError}</p>
            )}
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                { label: "Full Name *",  field: "name" as const,  type: "text" },
                { label: "Email *",      field: "email" as const, type: "email" },
                { label: "Phone",        field: "phone" as const, type: "text" },
              ].map(({ label, field, type }) => (
                <div key={field}>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
                  <input type={type} value={(form[field] as string) ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">City</label>
                  <input value={form.city ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">State</label>
                  <input value={form.state ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Address Line 1</label>
                <input value={form.address_line1 ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, address_line1: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Address Line 2</label>
                <input value={form.address_line2 ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, address_line2: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Postcode</label>
                <input value={form.postcode ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, postcode: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Country</label>
                <input value={form.country ?? "Australia"}
                  onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Work Status</label>
                <select value={form.work_status ?? "job_seeking"}
                  onChange={(e) => setForm((f) => ({ ...f, work_status: e.target.value as CandidateWorkStatus }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="job_seeking">Job Seeking</option>
                  <option value="employed">Employed</option>
                  <option value="placed">Placed</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Benchmark Hours / Week</label>
                <input type="number" min="1" max="168"
                  value={form.benchmark_hours ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, benchmark_hours: e.target.value ? Number(e.target.value) : undefined }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              {isAdmin && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Provider</label>
                  <select value={form.provider_id ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, provider_id: e.target.value || null }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">No provider</option>
                    {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Resume URL</label>
                <input value={form.resume_url ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, resume_url: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">LinkedIn URL</label>
                <input value={form.linkedin ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, linkedin: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Interested Job (type of role)</label>
              <input value={form.interested_job ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, interested_job: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Wage Subsidy</label>
                <select
                  value={form.wage_subsidy ? "yes" : "no"}
                  onChange={(e) => setForm((f) => ({ ...f, wage_subsidy: e.target.value === "yes", wage_subsidy_amount: e.target.value === "no" ? undefined : f.wage_subsidy_amount }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </div>
              {form.wage_subsidy && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Amount ($)</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.wage_subsidy_amount ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, wage_subsidy_amount: e.target.value ? Number(e.target.value) : undefined }))}
                    placeholder="e.g. 5000"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
              <textarea value={form.notes ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={3}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditing(false)}
                className="px-4 py-2 text-sm text-slate-600 border rounded-lg hover:bg-slate-50">Cancel</button>
              <button onClick={handleSave} disabled={updateCandidate.isPending}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-slate-800 text-white rounded-lg hover:bg-slate-900 disabled:opacity-50">
                <Check size={14} />
                {updateCandidate.isPending ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-full border border-blue-400 text-blue-600 bg-transparent flex items-center justify-center text-xl font-bold flex-shrink-0">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h1 className="text-xl font-bold text-slate-900">{candidate.name}</h1>
                  {candidate.work_status && (
                    <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium ${WORK_STATUS_BADGE[candidate.work_status]}`}>
                      {candidate.work_status.replace("_", " ")}
                    </span>
                  )}
                </div>
                {canWrite && (
                  <button onClick={startEdit}
                    className="flex items-center gap-1 text-xs text-slate-500 border rounded-lg px-2 py-1.5 hover:bg-slate-50 flex-shrink-0">
                    <Edit2 size={12} /> Edit
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-3 mt-2 text-sm text-slate-500">
                <span className="flex items-center gap-1"><Mail size={13} />{candidate.email}</span>
                {candidate.phone && <span className="flex items-center gap-1"><Phone size={13} />{candidate.phone}</span>}
                {(candidate.city || candidate.state) && (
                  <span className="flex items-center gap-1">
                    <MapPin size={13} />{[candidate.city, candidate.state].filter(Boolean).join(", ")}
                  </span>
                )}
              </div>

              {/* Address */}
              {(candidate.address_line1 || candidate.postcode) && (
                <p className="text-sm text-slate-500 mt-1">
                  {[candidate.address_line1, candidate.address_line2, candidate.postcode, candidate.country]
                    .filter(Boolean).join(", ")}
                </p>
              )}

              <div className="flex gap-3 mt-3">
                {candidate.resume_url && (
                  <a href={candidate.resume_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-slate-600 hover:underline">
                    <ExternalLink size={12} /> Resume
                  </a>
                )}
                {candidate.linkedin && (
                  <a href={candidate.linkedin} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-slate-600 hover:underline">
                    <ExternalLink size={12} /> LinkedIn
                  </a>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Work & Placement Section */}
      {!editing && (candidate.provider_id || candidate.benchmark_hours || candidate.interested_job || candidate.wage_subsidy) && (
        <div className="bg-white rounded-xl shadow-sm p-5 mb-4">
          <h2 className="font-semibold text-slate-900 tracking-tight mb-3">Work & Placement</h2>
          <dl className="grid sm:grid-cols-2 gap-3 text-sm">
            {candidate.provider_name && (
              <div>
                <dt className="text-xs font-medium text-slate-500 uppercase">Provider</dt>
                <dd className="mt-0.5">
                  <Link to={`/providers/${candidate.provider_id}`} className="text-slate-600 hover:underline">
                    {candidate.provider_name}
                  </Link>
                </dd>
              </div>
            )}
            {candidate.benchmark_hours && (
              <div>
                <dt className="text-xs font-medium text-slate-500 uppercase">Benchmark Hours</dt>
                <dd className="mt-0.5 text-slate-900">{candidate.benchmark_hours} hrs/week</dd>
              </div>
            )}
            {candidate.interested_job && (
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-slate-500 uppercase">Interested Job</dt>
                <dd className="mt-0.5 text-slate-900">{candidate.interested_job}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs font-medium text-slate-500 uppercase">Wage Subsidy</dt>
              <dd className="mt-0.5">
                {candidate.wage_subsidy ? (
                  <span className="text-green-700 font-medium">
                    Yes{candidate.wage_subsidy_amount ? ` — $${Number(candidate.wage_subsidy_amount).toLocaleString()}` : ""}
                  </span>
                ) : (
                  <span className="text-slate-500">No</span>
                )}
              </dd>
            </div>
          </dl>
        </div>
      )}

      {/* Notes */}
      {!editing && candidate.notes && (
        <div className="bg-white rounded-xl shadow-sm p-5 mb-4">
          <h2 className="font-semibold text-slate-900 tracking-tight mb-2">Notes</h2>
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{candidate.notes}</p>
        </div>
      )}

      {/* Documents */}
      <div className="bg-white rounded-xl shadow-sm p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-900 tracking-tight">Documents</h2>
          {canWrite && (
            <div className="flex items-center gap-2">
              <button onClick={() => { setDocType("cv"); setShowUpload(true); }}
                className="flex items-center gap-1.5 text-xs text-green-700 border border-green-300 rounded-lg px-3 py-1.5 hover:bg-green-50 font-medium">
                <Upload size={12} /> Upload Resume
              </button>
              <button onClick={() => { setDocType("other"); setShowUpload(true); }}
                className="flex items-center gap-1.5 text-xs text-slate-600 border border-slate-300 rounded-lg px-3 py-1.5 hover:bg-slate-50">
                <Upload size={12} /> Upload Document
              </button>
            </div>
          )}
        </div>

        {documents.length === 0 ? (
          <p className="text-sm text-slate-400">No documents uploaded yet.</p>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between border rounded-lg px-3 py-2">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText size={16} className="text-slate-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{doc.file_name}</p>
                    <p className="text-xs text-slate-400">
                      {format(new Date(doc.created_at), "MMM d, yyyy")}
                      {doc.uploaded_by_name && ` · ${doc.uploaded_by_name}`}
                      {doc.file_size && ` · ${Math.round(doc.file_size / 1024)} KB`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${DOC_TYPE_BADGE[doc.document_type] ?? DOC_TYPE_BADGE.other}`}>
                    {DOC_TYPE_LABEL[doc.document_type] ?? doc.document_type}
                  </span>
                  <a href={`${BASE_URL}/api/candidates/${id}/documents/${doc.id}/download`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-slate-500 border rounded px-2 py-1 hover:bg-slate-50">
                    <Download size={11} /> Download
                  </a>
                  {isAdmin && (
                    <button onClick={() => { if (confirm("Delete this document?")) deleteDoc.mutate(doc.id); }}
                      className="flex items-center gap-1 text-xs text-red-600 border border-red-200 rounded px-2 py-1 hover:bg-red-50">
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Application history */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <h2 className="font-semibold text-slate-900 tracking-tight mb-3">
          Application History
          <span className="text-slate-400 font-normal ml-1">({candidate.applications?.length ?? 0})</span>
        </h2>
        {!candidate.applications?.length ? (
          <p className="text-sm text-slate-400">No applications yet.</p>
        ) : (
          <div className="space-y-2">
            {candidate.applications.map((app) => (
              <div key={app.id} className="flex items-center justify-between border rounded-lg px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-slate-900">{app.job_title}</p>
                  <p className="text-xs text-slate-500">
                    Applied {format(new Date(app.applied_at), "MMM d, yyyy")}
                    {app.source && ` · ${app.source}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {app.score > 0 && <span className="text-xs text-slate-400">{app.score}/10</span>}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STAGE_BADGE[app.stage]}`}>
                    {app.stage}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload dialog */}
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
                className="px-4 py-2 text-sm bg-slate-800 text-white rounded-lg hover:bg-slate-900">
                Upload
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
