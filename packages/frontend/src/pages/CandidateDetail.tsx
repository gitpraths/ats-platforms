import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Mail, Phone, MapPin, ExternalLink, Edit2, X, Check } from "lucide-react";
import { format } from "date-fns";
import { api } from "../lib/api";
import type { Candidate, ApplicationStage } from "../types";

const STAGE_BADGE: Record<ApplicationStage, string> = {
  applied:   "bg-blue-100 text-blue-700",
  screening: "bg-purple-100 text-purple-700",
  interview: "bg-yellow-100 text-yellow-700",
  offer:     "bg-orange-100 text-orange-700",
  hired:     "bg-green-100 text-green-700",
  rejected:  "bg-red-100 text-red-600",
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
  const { id }        = useParams<{ id: string }>();
  const queryClient   = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm]       = useState<Partial<Candidate>>({});
  const [saveError, setSaveError] = useState("");

  const { data: candidate, isLoading } = useQuery<CandidateWithApps>({
    queryKey: ["candidate", id],
    queryFn:  () => api.get<CandidateWithApps>(`/candidates/${id}`),
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

  function startEdit() {
    if (!candidate) return;
    setForm({
      name:       candidate.name,
      email:      candidate.email,
      phone:      candidate.phone ?? "",
      city:       candidate.city ?? "",
      state:      candidate.state ?? "",
      resume_url: candidate.resume_url ?? "",
      linkedin:   candidate.linkedin ?? "",
      notes:      candidate.notes ?? "",
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

  if (isLoading) return <p className="p-6 text-gray-500">Loading...</p>;
  if (!candidate) return <p className="p-6 text-red-500">Candidate not found.</p>;

  const initials = candidate.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Link to="/candidates" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-4">
        <ArrowLeft size={15} /> Back to Candidates
      </Link>

      {/* Profile card */}
      <div className="bg-white border rounded-xl p-6 mb-4">
        {editing ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold text-gray-900">Edit Candidate</h2>
              <button onClick={() => setEditing(false)} className="text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            </div>

            {saveError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{saveError}</p>
            )}

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Full Name *</label>
                <input
                  value={form.name ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email *</label>
                <input
                  type="email"
                  value={form.email ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
                <input
                  value={form.phone ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">City</label>
                  <input
                    value={form.city ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">State</label>
                  <input
                    value={form.state ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Resume URL</label>
                <input
                  value={form.resume_url ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, resume_url: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">LinkedIn URL</label>
                <input
                  value={form.linkedin ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, linkedin: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <textarea
                value={form.notes ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={3}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setEditing(false)}
                className="px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={updateCandidate.isPending}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <Check size={14} />
                {updateCandidate.isPending ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xl font-bold flex-shrink-0">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <h1 className="text-xl font-bold text-gray-900">{candidate.name}</h1>
                <button
                  onClick={startEdit}
                  className="flex items-center gap-1 text-xs text-gray-500 border rounded-lg px-2 py-1.5 hover:bg-gray-50 flex-shrink-0"
                >
                  <Edit2 size={12} /> Edit
                </button>
              </div>
              <div className="flex flex-wrap gap-3 mt-2 text-sm text-gray-500">
                <span className="flex items-center gap-1"><Mail size={13} />{candidate.email}</span>
                {candidate.phone && <span className="flex items-center gap-1"><Phone size={13} />{candidate.phone}</span>}
                {(candidate.city || candidate.state) && (
                  <span className="flex items-center gap-1">
                    <MapPin size={13} />{[candidate.city, candidate.state].filter(Boolean).join(", ")}
                  </span>
                )}
              </div>
              <div className="flex gap-3 mt-3">
                {candidate.resume_url && (
                  <a href={candidate.resume_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                    <ExternalLink size={12} /> Resume
                  </a>
                )}
                {candidate.linkedin && (
                  <a href={candidate.linkedin} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                    <ExternalLink size={12} /> LinkedIn
                  </a>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Notes (view mode only) */}
      {!editing && candidate.notes && (
        <div className="bg-white border rounded-xl p-5 mb-4">
          <h2 className="font-semibold text-gray-900 mb-2">Notes</h2>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{candidate.notes}</p>
        </div>
      )}

      {/* Application history */}
      <div className="bg-white border rounded-xl p-5">
        <h2 className="font-semibold text-gray-900 mb-3">
          Application History
          <span className="text-gray-400 font-normal ml-1">({candidate.applications?.length ?? 0})</span>
        </h2>
        {!candidate.applications?.length ? (
          <p className="text-sm text-gray-400">No applications yet.</p>
        ) : (
          <div className="space-y-2">
            {candidate.applications.map((app) => (
              <div key={app.id} className="flex items-center justify-between border rounded-lg px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-gray-900">{app.job_title}</p>
                  <p className="text-xs text-gray-500">
                    Applied {format(new Date(app.applied_at), "MMM d, yyyy")}
                    {app.source && ` · ${app.source}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {app.score > 0 && (
                    <span className="text-xs text-gray-400">{app.score}/10</span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STAGE_BADGE[app.stage]}`}>
                    {app.stage}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
