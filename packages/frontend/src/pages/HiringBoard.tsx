import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { MoreHorizontal, List, Columns } from "lucide-react";
import { api } from "../lib/api";
import type { Application, ApplicationStage } from "../types";
import { format } from "date-fns";
import { stageLabel, fmtDate } from "../lib/utils";
import ScreenCandidateButton from "../components/ScreenCandidateButton";
import Pagination, { PER_PAGE } from "../components/Pagination";

const STAGES: ApplicationStage[] = ["applied", "interview", "ets", "hired", "rejected"];

const STAGE_STYLES: Record<ApplicationStage, { col: string; badge: string }> = {
  applied:   { col: "bg-blue-50 border-blue-200",   badge: "border border-blue-400 text-blue-600 bg-transparent" },
  screening: { col: "bg-purple-50 border-purple-200", badge: "border border-purple-400 text-purple-600 bg-transparent" },
  interview: { col: "bg-yellow-50 border-yellow-200", badge: "border border-amber-400 text-amber-600 bg-transparent" },
  ets:       { col: "bg-orange-50 border-orange-200", badge: "border border-orange-400 text-orange-600 bg-transparent" },
  hired:     { col: "bg-green-50 border-green-200",  badge: "border border-green-500 text-green-700 bg-transparent" },
  rejected:  { col: "bg-red-50 border-red-200",      badge: "border border-red-400 text-red-500 bg-transparent" },
};

// ── Stage Change Dialog ───────────────────────────────────────────────────────
function StageDialog({
  app,
  onClose,
  onSave,
}: {
  app: Application;
  onClose: () => void;
  onSave: (stage: ApplicationStage, score: number | null, notes: string) => void;
}) {
  const [stage, setStage] = useState<ApplicationStage>(app.stage);
  const [score, setScore] = useState<string>(app.score != null ? String(app.score) : "");
  const [notes, setNotes] = useState<string>(app.notes ?? "");

  function handleSave() {
    const parsedScore = score.trim() !== "" ? Number(score) : null;
    onSave(stage, parsedScore, notes);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-96">
        <h3 className="font-semibold text-slate-900 mb-4">Edit Application</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
            <select
              value={stage}
              onChange={(e) => setStage(e.target.value as ApplicationStage)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            >
              {STAGES.map((s) => (
                <option key={s} value={s}>{stageLabel(s)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Score (0–10)</label>
            <input
              type="number"
              min={0}
              max={10}
              value={score}
              onChange={(e) => setScore(e.target.value)}
              placeholder="e.g. 7"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Recruiter notes about this applicant..."
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex gap-2 justify-end mt-5">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
          <button onClick={handleSave} className="px-4 py-2 text-sm bg-[#e88e2e] text-white rounded-lg hover:bg-[#d07d20]">Save</button>
        </div>
      </div>
    </div>
  );
}

// ── Card Actions Menu ─────────────────────────────────────────────────────────
function CardMenu({
  app,
  onChangeStage,
  onDelete,
}: {
  app: Application;
  onChangeStage: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="p-1 rounded hover:bg-slate-100"
      >
        <MoreHorizontal size={14} />
      </button>
      {open && (
        <div className="absolute right-0 top-6 bg-white border rounded-lg shadow-lg z-10 w-44 py-1">
          <button
            onClick={() => { setOpen(false); onChangeStage(); }}
            className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
          >
            Edit Application
          </button>
          <a
            href={`/candidates/${app.candidate_id}`}
            className="block px-3 py-2 text-sm hover:bg-slate-50"
          >
            View Candidate
          </a>
          <button
            onClick={() => { setOpen(false); onDelete(); }}
            className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50"
          >
            Remove Application
          </button>
        </div>
      )}
    </div>
  );
}

// ── Pipeline View (Kanban) ────────────────────────────────────────────────────
function PipelineView({
  applications,
  onStageChange,
  onOpenStageDialog,
  onDelete,
}: {
  applications: Application[];
  onStageChange: (id: string, stage: ApplicationStage) => void;
  onOpenStageDialog: (app: Application) => void;
  onDelete: (id: string) => void;
}) {
  function onDragEnd(result: DropResult) {
    if (!result.destination) return;
    onStageChange(result.draggableId, result.destination.droppableId as ApplicationStage);
  }

  const byStage = (s: ApplicationStage) => applications.filter((a) => a.stage === s);

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {STAGES.map((stage) => (
          <div key={stage} className="min-w-[210px] flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">{stageLabel(stage)}</span>
              <span className="text-xs text-slate-400 bg-slate-100 rounded-full px-2">{byStage(stage).length}</span>
            </div>
            <Droppable droppableId={stage}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`min-h-[100px] rounded-xl border p-2 space-y-2 transition-colors ${
                    snapshot.isDraggingOver ? "border-blue-400 bg-blue-50" : STAGE_STYLES[stage].col
                  }`}
                >
                  {byStage(stage).map((app, idx) => (
                    <Draggable key={app.id} draggableId={app.id} index={idx}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          style={provided.draggableProps.style as React.CSSProperties}
                          className={`bg-white rounded-lg border p-3 text-sm ${
                            snapshot.isDragging ? "shadow-lg rotate-1" : "shadow-sm"
                          } cursor-grab active:cursor-grabbing`}
                        >
                          <div className="flex items-start justify-between gap-1">
                            <div className="min-w-0">
                              <p className="font-medium text-slate-900 truncate">{app.candidate_name}</p>
                              <p className="text-xs text-slate-500 truncate">{app.candidate_email}</p>
                              <p className="text-xs text-slate-400 mt-1 truncate">{app.job_title}</p>
                              <p className="text-xs text-slate-400 mt-1">
                                {app.applied_at ? fmtDate(app.applied_at) : ""}
                              </p>
                              {app.source && (
                                <span className="inline-block mt-1 text-xs border border-slate-400 text-slate-600 bg-transparent rounded px-1">{app.source}</span>
                              )}
                            </div>
                            <CardMenu app={app} onChangeStage={() => onOpenStageDialog(app)} onDelete={() => onDelete(app.id)} />
                          </div>
                          {app.score != null && app.score > 0 && (
                            <p className="text-xs text-yellow-500 mt-1">{app.score}/10</p>
                          )}
                          {app.ets_date && (() => {
                            const d = new Date(app.ets_date);
                            const now = new Date();
                            const soon = new Date(Date.now() + 7 * 86400000);
                            const cls = d <= now
                              ? "bg-red-100 text-red-700"
                              : d <= soon
                              ? "bg-amber-100 text-amber-700"
                              : "bg-blue-50 text-blue-600";
                            return (
                              <span className={`inline-block mt-1.5 text-[10px] font-semibold px-2 py-0.5 rounded ${cls}`}>
                                ETS: {format(d, "d MMM yy")}
                              </span>
                            );
                          })()}
                          <div className="mt-2">
                            <ScreenCandidateButton
                              candidateNotes={[app.candidate_name, app.candidate_email, app.notes].filter(Boolean).join(" | ")}
                              jobTitle={app.job_title ?? ""}
                            />
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </div>
        ))}
      </div>
    </DragDropContext>
  );
}

// ── List View ─────────────────────────────────────────────────────────────────
function ListView({
  applications,
  onOpenStageDialog,
  onDelete,
}: {
  applications: Application[];
  onOpenStageDialog: (app: Application) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b text-left text-xs text-slate-500 uppercase tracking-wide">
            <th className="py-3 pr-4">Applicant</th>
            <th className="py-3 pr-4">Job Posting</th>
            <th className="py-3 pr-4">Status</th>
            <th className="py-3 pr-4">Score</th>
            <th className="py-3 pr-4">Interview Date</th>
            <th className="py-3 pr-4">ETS Date</th>
            <th className="py-3 pr-4">Applied</th>
            <th className="py-3"></th>
          </tr>
        </thead>
        <tbody>
          {applications.map((app) => (
            <tr key={app.id} className="border-b hover:bg-slate-50">
              <td className="py-3 pr-4">
                <p className="font-medium text-slate-900">{app.candidate_name}</p>
                <p className="text-xs text-slate-500">{app.candidate_email}</p>
              </td>
              <td className="py-3 pr-4 text-slate-700">{app.job_title}</td>
              <td className="py-3 pr-4">
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${STAGE_STYLES[app.stage].badge}`}>
                  {app.stage}
                </span>
              </td>
              <td className="py-3 pr-4 text-slate-600">{app.score ?? "—"}</td>
              <td className="py-3 pr-4 text-slate-600 text-xs whitespace-nowrap">
                {app.interview_date ? fmtDate(app.interview_date) : "—"}
              </td>
              <td className="py-3 pr-4 text-xs whitespace-nowrap">
                {app.ets_date ? (() => {
                  const d = new Date(app.ets_date);
                  const cls = d <= new Date() ? "text-red-600 font-semibold" : d <= new Date(Date.now() + 7 * 86400000) ? "text-amber-600 font-semibold" : "text-slate-600";
                  return <span className={cls}>{format(d, "d MMM yyyy")}</span>;
                })() : "—"}
              </td>
              <td className="py-3 pr-4 text-slate-500 text-xs">
                {app.applied_at ? fmtDate(app.applied_at) : "—"}
              </td>
              <td className="py-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onOpenStageDialog(app)}
                    className="text-xs text-slate-600 hover:underline"
                  >
                    Edit
                  </button>
                  <ScreenCandidateButton
                    candidateNotes={[app.candidate_name, app.candidate_email, app.notes].filter(Boolean).join(" | ")}
                    jobTitle={app.job_title ?? ""}
                  />
                  <button
                    onClick={() => { if (confirm("Remove this application?")) onDelete(app.id); }}
                    className="text-xs text-red-500 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {applications.length === 0 && (
        <p className="text-center text-slate-400 py-8">No applications found.</p>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function HiringBoard() {
  const queryClient                       = useQueryClient();
  const [view, setView]                   = useState<"pipeline" | "list">("list");
  const [stageDialogApp, setStageDialogApp] = useState<Application | null>(null);
  const [listPage, setListPage]           = useState(1);

  const { data: applications = [], isLoading } = useQuery<Application[]>({
    queryKey: ["applications"],
    queryFn:  () => api.get<Application[]>("/applications"),
  });

  const [updateError, setUpdateError] = useState<string | null>(null);

  const deleteApp = useMutation({
    mutationFn: (id: string) => api.delete(`/applications/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["applications"] }),
    onError: (err: Error) => setUpdateError(err.message),
  });

  const updateApp = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { stage?: ApplicationStage; score?: number | null; notes?: string } }) =>
      api.patch(`/applications/${id}`, payload),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["applications"] }); setUpdateError(null); },
    onError: (err: Error) => setUpdateError(err.message),
  });

  function handleStageChange(id: string, stage: ApplicationStage) {
    updateApp.mutate({ id, payload: { stage } });
  }

  if (isLoading) return <p className="p-6 text-slate-500">Loading...</p>;

  return (
    <div className="p-6">
      {updateError && (
        <div className="mb-4 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {updateError}
        </div>
      )}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">Important Updates</h1>
        <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => setView("pipeline")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition ${
              view === "pipeline" ? "bg-white shadow text-slate-900" : "text-slate-500"
            }`}
          >
            <Columns size={14} /> Pipeline
          </button>
          <button
            onClick={() => setView("list")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition ${
              view === "list" ? "bg-white shadow text-slate-900" : "text-slate-500"
            }`}
          >
            <List size={14} /> List
          </button>
        </div>
      </div>

      {view === "pipeline" ? (
        <PipelineView
          applications={applications}
          onStageChange={handleStageChange}
          onOpenStageDialog={setStageDialogApp}
          onDelete={(id) => { if (confirm("Remove this application?")) deleteApp.mutate(id); }}
        />
      ) : (
        <div className="bg-white rounded-xl shadow-sm p-4">
          <Pagination
            page={listPage}
            totalPages={Math.max(1, Math.ceil(applications.length / PER_PAGE))}
            total={applications.length}
            perPage={PER_PAGE}
            onChange={setListPage}
            label="applications"
          />
          <ListView
            applications={applications.slice((listPage - 1) * PER_PAGE, listPage * PER_PAGE)}
            onOpenStageDialog={setStageDialogApp}
            onDelete={(id) => deleteApp.mutate(id)}
          />
          <Pagination
            page={listPage}
            totalPages={Math.max(1, Math.ceil(applications.length / PER_PAGE))}
            total={applications.length}
            perPage={PER_PAGE}
            onChange={setListPage}
            label="applications"
          />
        </div>
      )}

      {stageDialogApp && (
        <StageDialog
          app={stageDialogApp}
          onClose={() => setStageDialogApp(null)}
          onSave={(stage, score, notes) => {
            updateApp.mutate({ id: stageDialogApp.id, payload: { stage, score, notes } });
            setStageDialogApp(null);
          }}
        />
      )}
    </div>
  );
}
