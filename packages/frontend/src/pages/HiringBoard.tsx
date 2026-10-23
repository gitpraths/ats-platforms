import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { MoreHorizontal, List, Columns, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { api } from "../lib/api";
import type { Application, ApplicationStage } from "../types";
import { stageLabel, fmtDate, formatName } from "../lib/utils";
import Pagination, { PER_PAGE } from "../components/Pagination";
import { CandidateBadge } from "../components/CandidateBadge";

const STAGES: ApplicationStage[] = ["applied", "interview", "ets", "hired", "rejected"];

const STAGE_STYLES: Record<ApplicationStage, { col: string; badge: string }> = {
  applied:   { col: "bg-blue-50 border-blue-200",   badge: "border border-blue-400 text-blue-600 bg-transparent" },
  screening: { col: "bg-purple-50 border-purple-200", badge: "border border-purple-400 text-purple-600 bg-transparent" },
  interview: { col: "bg-yellow-50 border-yellow-200", badge: "border border-amber-400 text-amber-600 bg-transparent" },
  ets:       { col: "bg-orange-50 border-orange-200", badge: "border border-orange-400 text-orange-600 bg-transparent" },
  hired:     { col: "bg-green-50 border-green-200",  badge: "border border-green-500 text-green-700 bg-transparent" },
  rejected:  { col: "bg-red-50 border-red-200",      badge: "border border-red-400 text-red-500 bg-transparent" },
};

type SortField =
  | "candidate_sr_no"
  | "candidate_name"
  | "job_title"
  | "stage"
  | "interview_date"
  | "ets_date"
  | "applied_at";

function compareApplications(a: Application, b: Application, field: SortField, dir: "asc" | "desc"): number {
  let valA: any = a[field as keyof Application];
  let valB: any = b[field as keyof Application];

  if (field === "stage") {
    const stageOrder: Record<string, number> = {
      applied: 1,
      screening: 2,
      interview: 3,
      ets: 4,
      hired: 5,
      rejected: 6,
    };
    valA = stageOrder[a.stage] ?? 99;
    valB = stageOrder[b.stage] ?? 99;
  }

  if (valA == null && valB == null) return 0;
  if (valA == null) return 1;
  if (valB == null) return -1;

  if (typeof valA === "string" && typeof valB === "string") {
    const cmp = valA.localeCompare(valB, undefined, { sensitivity: "base", numeric: true });
    return dir === "asc" ? cmp : -cmp;
  }

  if (valA < valB) return dir === "asc" ? -1 : 1;
  if (valA > valB) return dir === "asc" ? 1 : -1;
  return 0;
}

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
  const [notes, setNotes] = useState<string>(app.notes ?? "");

  function handleSave() {
    onSave(stage, null, notes);
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
          <Link
            to={`/candidates/${app.candidate_id}`}
            className="block px-3 py-2 text-sm hover:bg-slate-50"
          >
            View Candidate
          </Link>
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
              <span className="text-xs bg-slate-200 text-slate-700 font-bold px-1.5 py-0.5 rounded-full">
                {byStage(stage).length}
              </span>
            </div>

            <Droppable droppableId={stage}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`rounded-xl border p-2 min-h-[300px] space-y-2 transition-colors ${
                    snapshot.isDraggingOver ? "bg-blue-50/50" : STAGE_STYLES[stage].col
                  }`}
                >
                  {byStage(stage).map((app, index) => (
                    <Draggable key={app.id} draggableId={app.id} index={index}>
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
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <CandidateBadge srNo={app.candidate_sr_no} />
                                <Link
                                  to={`/candidates/${app.candidate_id}`}
                                  className="font-semibold text-slate-900 hover:text-[#e88e2e] hover:underline truncate"
                                >
                                  {formatName(app.candidate_name)}
                                </Link>
                              </div>
                              <p className="text-xs text-slate-500 truncate mt-0.5">{app.candidate_email}</p>
                              <p className="text-xs text-slate-600 mt-1 truncate font-medium">{app.job_title}</p>
                              <p className="text-xs text-slate-400 mt-1">
                                {app.applied_at ? fmtDate(app.applied_at) : ""}
                              </p>
                              {app.source && (
                                <span className="inline-block mt-1 text-xs border border-slate-400 text-slate-600 bg-transparent rounded px-1">{app.source}</span>
                              )}
                            </div>
                            <CardMenu app={app} onChangeStage={() => onOpenStageDialog(app)} onDelete={() => onDelete(app.id)} />
                          </div>

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
                              <span className={`inline-block mt-2 text-[11px] font-semibold px-2 py-0.5 rounded ${cls}`}>
                                ETS: {fmtDate(app.ets_date)}
                              </span>
                            );
                          })()}
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

// ── Header Component for Sortable Columns ─────────────────────────────────────
function SortHeader({
  field,
  label,
  currentField,
  currentDir,
  onSort,
  className = "",
}: {
  field: SortField;
  label: string;
  currentField: SortField;
  currentDir: "asc" | "desc";
  onSort: (field: SortField) => void;
  className?: string;
}) {
  const isActive = currentField === field;
  return (
    <th
      onClick={() => onSort(field)}
      className={`py-3 pr-4 font-semibold uppercase tracking-wide cursor-pointer select-none hover:text-slate-900 transition-colors ${className}`}
    >
      <div className="flex items-center gap-1.5">
        <span>{label}</span>
        {isActive ? (
          currentDir === "asc" ? (
            <ArrowUp size={13} className="text-[#e88e2e]" />
          ) : (
            <ArrowDown size={13} className="text-[#e88e2e]" />
          )
        ) : (
          <ArrowUpDown size={12} className="text-slate-400 opacity-60" />
        )}
      </div>
    </th>
  );
}

function ListView({
  applications,
  onOpenStageDialog,
  onDelete,
  sortField,
  sortDir,
  onSort,
}: {
  applications: Application[];
  onOpenStageDialog: (app: Application) => void;
  onDelete: (id: string) => void;
  sortField: SortField;
  sortDir: "asc" | "desc";
  onSort: (field: SortField) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b text-left text-xs text-slate-500 uppercase tracking-wide">
            <SortHeader field="candidate_sr_no" label="SR #" currentField={sortField} currentDir={sortDir} onSort={onSort} className="pl-3 w-[105px] min-w-[105px] whitespace-nowrap" />
            <SortHeader field="candidate_name" label="Applicant" currentField={sortField} currentDir={sortDir} onSort={onSort} className="whitespace-nowrap" />
            <SortHeader field="job_title" label="Job Posting" currentField={sortField} currentDir={sortDir} onSort={onSort} className="whitespace-nowrap" />
            <SortHeader field="stage" label="Status" currentField={sortField} currentDir={sortDir} onSort={onSort} className="whitespace-nowrap" />
            <SortHeader field="interview_date" label="Interview Date" currentField={sortField} currentDir={sortDir} onSort={onSort} className="whitespace-nowrap" />
            <SortHeader field="ets_date" label="ETS Date" currentField={sortField} currentDir={sortDir} onSort={onSort} className="whitespace-nowrap" />
            <SortHeader field="applied_at" label="Applied" currentField={sortField} currentDir={sortDir} onSort={onSort} className="whitespace-nowrap" />
            <th className="py-3 pr-4 text-right whitespace-nowrap">Actions</th>
          </tr>
        </thead>
        <tbody>
          {applications.map((app) => {
            return (
              <tr key={app.id} className="border-b hover:bg-slate-50 transition">
                <td className="py-3 pl-3 pr-4 w-[105px] min-w-[105px] whitespace-nowrap">
                  {app.candidate_sr_no ? (
                    <span className="inline-flex items-center bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-xs font-mono font-semibold text-slate-700 whitespace-nowrap select-none">
                      {app.candidate_sr_no}
                    </span>
                  ) : (
                    <span className="text-slate-300 text-xs">—</span>
                  )}
                </td>
                <td className="py-3 pr-4">
                  <Link
                    to={`/candidates/${app.candidate_id}`}
                    className="font-semibold text-slate-900 hover:text-[#e88e2e] hover:underline block text-sm"
                  >
                    {formatName(app.candidate_name)}
                  </Link>
                  <p className="text-xs text-slate-500">{app.candidate_email}</p>
                </td>
                <td className="py-3 pr-4 text-slate-700 font-medium">{app.job_title}</td>
                <td className="py-3 pr-4">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STAGE_STYLES[app.stage]?.badge ?? "border border-slate-300 text-slate-600"}`}>
                    {stageLabel(app.stage)}
                  </span>
                </td>
                <td className="py-3 pr-4 text-slate-600 text-xs whitespace-nowrap">
                  {app.interview_date ? fmtDate(app.interview_date) : "—"}
                </td>
                <td className="py-3 pr-4 text-xs whitespace-nowrap">
                  {app.ets_date ? (() => {
                    const d = new Date(app.ets_date);
                    const isOverdue = d <= new Date();
                    const isSoon = d <= new Date(Date.now() + 7 * 86400000);
                    const cls = isOverdue ? "text-red-600 font-semibold" : isSoon ? "text-amber-600 font-semibold" : "text-slate-600";
                    return <span className={cls}>{fmtDate(app.ets_date)}</span>;
                  })() : "—"}
                </td>
                <td className="py-3 pr-4 text-slate-500 text-xs whitespace-nowrap">
                  {app.applied_at ? fmtDate(app.applied_at) : "—"}
                </td>
                <td className="py-3 pr-4 text-right">
                  <div className="flex items-center justify-end gap-2 text-xs">
                    <button
                      onClick={() => onOpenStageDialog(app)}
                      className="text-slate-600 hover:text-slate-900 font-medium hover:underline"
                    >
                      Edit
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      onClick={() => { if (confirm("Remove this application?")) onDelete(app.id); }}
                      className="text-red-500 hover:text-red-700 font-medium hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
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
  const queryClient                         = useQueryClient();
  const [view, setView]                     = useState<"pipeline" | "list">("list");
  const [stageDialogApp, setStageDialogApp] = useState<Application | null>(null);
  const [listPage, setListPage]             = useState(1);
  const [sortField, setSortField]           = useState<SortField>("applied_at");
  const [sortDir, setSortDir]               = useState<"asc" | "desc">("desc");

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

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "applied_at" || field === "ets_date" || field === "interview_date" ? "desc" : "asc");
    }
    setListPage(1);
  }

  const sortedApplications = useMemo(() => {
    return [...applications].sort((a, b) => compareApplications(a, b, sortField, sortDir));
  }, [applications, sortField, sortDir]);

  if (isLoading) return <p className="p-6 text-slate-500">Loading...</p>;

  return (
    <div className="min-h-screen bg-[#F1F5F9] px-4 py-4 sm:px-6 sm:py-5">
      <div className="max-w-7xl mx-auto border border-slate-200 rounded-2xl shadow-sm bg-[#F8FAFC] p-6 space-y-5">
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
              totalPages={Math.max(1, Math.ceil(sortedApplications.length / PER_PAGE))}
              total={sortedApplications.length}
              perPage={PER_PAGE}
              onChange={setListPage}
              label="applications"
            />
            <ListView
              applications={sortedApplications.slice((listPage - 1) * PER_PAGE, listPage * PER_PAGE)}
              onOpenStageDialog={setStageDialogApp}
              onDelete={(id) => deleteApp.mutate(id)}
              sortField={sortField}
              sortDir={sortDir}
              onSort={handleSort}
            />
            <Pagination
              page={listPage}
              totalPages={Math.max(1, Math.ceil(sortedApplications.length / PER_PAGE))}
              total={sortedApplications.length}
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
    </div>
  );
}
