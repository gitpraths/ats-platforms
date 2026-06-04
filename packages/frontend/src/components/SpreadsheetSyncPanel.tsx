import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import {
  CheckCircle2, XCircle, Loader2, Unplug, RefreshCw,
  Link2, Search, FileSpreadsheet, ChevronRight, ArrowLeft, LayoutGrid,
} from "lucide-react";
import {
  useSyncLogs, useMsAuthUrl, useDisconnect, useSaveSpreadsheet,
  useTriggerSync, useSearchOneDriveFiles, useOneDriveSheets,
  type OneDriveFile,
} from "../hooks/useSpreadsheetSync";
import type { Provider } from "../types";

interface Props {
  provider: Provider;
  isAdmin: boolean;
}

export default function SpreadsheetSyncPanel({ provider, isAdmin }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [showPicker, setShowPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<OneDriveFile | null>(null);
  const [selectedSheet, setSelectedSheet] = useState("Sheet1");
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const msConnected = !!provider.ms_user_email;
  const isConnected = !!provider.ms_user_email && !!provider.onedrive_file_id;

  const { data: logs = [], isLoading: logsLoading } = useSyncLogs(provider.id);
  const connectMutation   = useMsAuthUrl(provider.id);
  const disconnectMutation = useDisconnect(provider.id);
  const saveMutation      = useSaveSpreadsheet(provider.id);
  const syncMutation      = useTriggerSync(provider.id);

  const pickerEnabled = showPicker && !selectedFile && activeQuery !== null;
  const { data: files = [], isFetching: filesLoading } = useSearchOneDriveFiles(
    provider.id, activeQuery ?? "", pickerEnabled
  );
  const { data: sheets = [], isLoading: sheetsLoading } = useOneDriveSheets(
    provider.id,
    showPicker && selectedFile ? selectedFile.id : null,
    showPicker && selectedFile ? selectedFile.drive_id : null
  );



  // After OAuth callback: auto-open picker
  useEffect(() => {
    if (searchParams.get("connected") === "true") {
      setShowPicker(true);
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  // Auto-select first sheet when sheets load
  useEffect(() => {
    if (sheets.length > 0) setSelectedSheet(sheets[0].name);
  }, [sheets]);

  async function handleConnect() {
    const result = await connectMutation.mutateAsync();
    window.location.href = result.url;
  }

  function openPicker() {
    setShowPicker(true);
    setSelectedFile(null);
    setSearchQuery("");
    setActiveQuery(null);
  }

  function closePicker() {
    setShowPicker(false);
    setSelectedFile(null);
    setSearchQuery("");
    setActiveQuery(null);
  }

  function handleSearch() {
    setActiveQuery(searchQuery.trim());
  }

  function handleFileSelect(file: OneDriveFile) {
    setSelectedFile(file);
  }

  async function handleSave() {
    if (!selectedFile) return;
    await saveMutation.mutateAsync({
      onedrive_file_id: selectedFile.id,
      onedrive_sheet_name: selectedSheet,
    });
    closePicker();
    setSyncMessage("Spreadsheet connected. Run your first sync.");
  }

  async function handleSync() {
    setSyncMessage(null);
    const result = await syncMutation.mutateAsync();
    setSyncMessage(
      `Sync complete — ${result.candidates_created} created, ${result.candidates_updated} updated, ${result.rows_written_back} written back.`
    );
  }

  return (
    <div className="border border-slate-200 rounded-xl p-5 mt-6 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <LayoutGrid size={16} className="text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-800">Spreadsheet Sync</h3>
        </div>

        {/* Connected file name + change link */}
        {isConnected && !showPicker && isAdmin && (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <FileSpreadsheet size={13} />
            <span className="text-slate-600">{provider.onedrive_sheet_name ?? "Sheet1"}</span>
            <button onClick={openPicker} className="text-blue-500 hover:underline">Change</button>
          </div>
        )}
      </div>

      {/* Status row */}
      <div className="flex items-center gap-2 mb-4">
        {isConnected ? (
          <>
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block flex-shrink-0" />
            <span className="text-sm text-slate-700">
              Connected as <span className="font-medium">{provider.ms_user_email}</span>
            </span>
            {provider.last_synced_at && (
              <span className="text-xs text-slate-400 ml-2">
                Last synced {format(new Date(provider.last_synced_at), "d MMM yyyy, h:mm a")}
              </span>
            )}
          </>
        ) : msConnected ? (
          <>
            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block flex-shrink-0" />
            <span className="text-sm text-slate-600">
              Microsoft account connected — no spreadsheet selected
            </span>
          </>
        ) : (
          <>
            <span className="w-2 h-2 rounded-full bg-slate-300 inline-block flex-shrink-0" />
            <span className="text-sm text-slate-500">Not connected</span>
          </>
        )}
      </div>

      {/* Action buttons */}
      {isAdmin && (
        <div className="flex flex-wrap gap-2 mb-4">
          {/* Step 1: Connect Microsoft account */}
          {!msConnected && (
            <button
              onClick={handleConnect}
              disabled={connectMutation.isPending}
              className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md bg-[#0078d4] text-white hover:bg-[#006cbe] disabled:opacity-50"
            >
              {connectMutation.isPending
                ? <Loader2 size={14} className="animate-spin" />
                : <Link2 size={14} />}
              Connect OneDrive
            </button>
          )}

          {/* Step 2: Pick spreadsheet (ms connected but no file) */}
          {msConnected && !isConnected && !showPicker && (
            <button
              onClick={openPicker}
              className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md bg-slate-800 text-white hover:bg-slate-900"
            >
              <FileSpreadsheet size={14} />
              Choose Spreadsheet
            </button>
          )}

          {/* Step 3: Sync controls */}
          {isConnected && !showPicker && (
            <>
              <button
                onClick={handleSync}
                disabled={syncMutation.isPending}
                className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md bg-slate-800 text-white hover:bg-slate-900 disabled:opacity-50"
              >
                {syncMutation.isPending
                  ? <Loader2 size={14} className="animate-spin" />
                  : <RefreshCw size={14} />}
                Sync Now
              </button>
              <button
                onClick={() => disconnectMutation.mutate()}
                disabled={disconnectMutation.isPending}
                className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                <Unplug size={14} />
                Disconnect
              </button>
            </>
          )}
        </div>
      )}

      {/* ── File Picker ── */}
      {showPicker && msConnected && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg overflow-hidden mb-4">
          {/* Picker header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 bg-white">
            {selectedFile ? (
              <button
                onClick={() => setSelectedFile(null)}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800"
              >
                <ArrowLeft size={13} /> Back to file list
              </button>
            ) : (
              <span className="text-xs font-medium text-slate-600">Step 1 — Choose a spreadsheet</span>
            )}
            <button onClick={closePicker} className="text-xs text-slate-400 hover:text-slate-600">Cancel</button>
          </div>

          {/* Step 1: File search */}
          {!selectedFile && (
            <div className="p-3">
              {/* Search input + button */}
              <div className="flex gap-2 mb-3">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleSearch()}
                    placeholder="e.g. Candidates 2026..."
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    autoFocus
                  />
                </div>
                <button
                  onClick={handleSearch}
                  disabled={filesLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex-shrink-0"
                >
                  {filesLoading
                    ? <Loader2 size={14} className="animate-spin" />
                    : <Search size={14} />}
                  Search
                </button>
              </div>

              {activeQuery === null ? (
                <div className="py-8 text-center">
                  <Search size={28} className="mx-auto text-slate-200 mb-2" />
                  <p className="text-sm text-slate-400">Type a filename and click <span className="font-medium text-slate-500">Search</span></p>
                  <p className="text-xs text-slate-300 mt-1">e.g. "Candidates", "Agency List", "Staff"</p>
                </div>
              ) : filesLoading ? (
                <div className="flex items-center justify-center py-8 text-slate-400 gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  <span className="text-sm">Searching your OneDrive...</span>
                </div>
              ) : files.length === 0 ? (
                <div className="py-8 text-center">
                  <FileSpreadsheet size={28} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-sm text-slate-400">
                    {activeQuery ? `No Excel files found for "${activeQuery}"` : "No Excel files found in your OneDrive"}
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100 max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white">
                  {files.map(file => (
                    <li key={file.id}>
                      <button
                        onClick={() => handleFileSelect(file)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-blue-50 group transition-colors"
                      >
                        <FileSpreadsheet size={16} className="text-green-600 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{file.name}</p>
                          {file.last_modified && (
                            <p className="text-xs text-slate-400">
                              Modified {format(new Date(file.last_modified), "d MMM yyyy")}
                            </p>
                          )}
                        </div>
                        <ChevronRight size={14} className="text-slate-300 group-hover:text-blue-500 flex-shrink-0" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Step 2: Sheet picker */}
          {selectedFile && (
            <div className="p-4">
              {/* Selected file badge */}
              <div className="flex items-center gap-2 p-2.5 bg-green-50 border border-green-200 rounded-lg mb-4">
                <FileSpreadsheet size={15} className="text-green-600 flex-shrink-0" />
                <span className="text-sm font-medium text-green-800 truncate flex-1">{selectedFile.name}</span>
                <CheckCircle2 size={14} className="text-green-500 flex-shrink-0" />
              </div>

              <p className="text-xs font-medium text-slate-500 mb-2">Step 2 — Choose a sheet tab</p>

              {sheetsLoading ? (
                <div className="flex items-center gap-2 text-slate-400 py-3">
                  <Loader2 size={14} className="animate-spin" />
                  <span className="text-sm">Loading sheets...</span>
                </div>
              ) : sheets.length === 0 ? (
                <p className="text-sm text-slate-400 py-2">No sheets found in this file.</p>
              ) : (
                <select
                  value={selectedSheet}
                  onChange={e => setSelectedSheet(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 mb-4"
                >
                  {sheets.map(s => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </select>
              )}

              <div className="flex justify-end">
                <button
                  onClick={handleSave}
                  disabled={saveMutation.isPending || sheetsLoading || sheets.length === 0}
                  className="inline-flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saveMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  {saveMutation.isPending ? "Connecting..." : "Save & Connect"}
                </button>
              </div>

              {saveMutation.isError && (
                <p className="text-xs text-red-600 mt-2">{saveMutation.error.message}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Sync result / error messages */}
      {syncMessage && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2 mb-4">
          {syncMessage}
        </p>
      )}
      {syncMutation.isError && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2 mb-4">
          Sync failed: {(syncMutation.error as Error).message}
        </p>
      )}

      {/* Sync history */}
      {isConnected && !showPicker && (
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Recent Syncs</p>
          {logsLoading ? (
            <p className="text-xs text-slate-400">Loading...</p>
          ) : logs.length === 0 ? (
            <p className="text-xs text-slate-400">No syncs yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {logs.slice(0, 5).map(log => (
                <li key={log.id} className="flex items-start gap-2 text-xs text-slate-600">
                  {log.status === 'success' || log.status === 'partial' ? (
                    <CheckCircle2 size={13} className="text-green-500 mt-0.5 shrink-0" />
                  ) : log.status === 'failed' ? (
                    <XCircle size={13} className="text-red-500 mt-0.5 shrink-0" />
                  ) : (
                    <Loader2 size={13} className="text-blue-400 mt-0.5 shrink-0 animate-spin" />
                  )}
                  <span>
                    {format(new Date(log.started_at), "d MMM h:mm a")}
                    {log.status === 'failed'
                      ? ` — Failed: ${log.error_message}`
                      : ` — ${log.candidates_created} created, ${log.candidates_updated} updated, ${log.rows_written_back} written back`}
                    {log.rows_skipped > 0 && `, ${log.rows_skipped} skipped`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
