import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { CheckCircle2, XCircle, Loader2, Unplug, RefreshCw, Link2 } from "lucide-react";
import {
  useSyncLogs,
  useMsAuthUrl,
  useDisconnect,
  useSaveSpreadsheet,
  useTriggerSync,
} from "../hooks/useSpreadsheetSync";
import type { Provider } from "../types";

interface Props {
  provider: Provider;
  isAdmin: boolean;
}

export default function SpreadsheetSyncPanel({ provider, isAdmin }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [showFileForm, setShowFileForm] = useState(false);
  const [fileUrl, setFileUrl] = useState("");
  const [sheetName, setSheetName] = useState(provider.onedrive_sheet_name || "Sheet1");
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const { data: logs = [], isLoading: logsLoading } = useSyncLogs(provider.id);
  const connectMutation = useMsAuthUrl(provider.id);
  const disconnectMutation = useDisconnect(provider.id);
  const saveMutation = useSaveSpreadsheet(provider.id);
  const syncMutation = useTriggerSync(provider.id);

  const isConnected = !!provider.ms_user_email && !!provider.onedrive_file_id;

  useEffect(() => {
    if (searchParams.get("connected") === "true") {
      setShowFileForm(true);
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  async function handleConnect() {
    const result = await connectMutation.mutateAsync();
    window.location.href = result.url;
  }

  async function handleSaveFile() {
    if (!fileUrl.trim()) return;
    await saveMutation.mutateAsync({
      onedrive_url: fileUrl.trim(),
      onedrive_sheet_name: sheetName.trim() || "Sheet1",
    });
    setShowFileForm(false);
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
    <div className="border border-slate-200 rounded-lg p-5 mt-6">
      <h3 className="text-base font-semibold text-slate-800 mb-4">Spreadsheet Sync</h3>

      {/* Status row */}
      <div className="flex items-center gap-2 mb-4">
        {isConnected ? (
          <>
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
            <span className="text-sm text-slate-700">
              Connected as <span className="font-medium">{provider.ms_user_email}</span>
            </span>
            {provider.last_synced_at && (
              <span className="text-xs text-slate-400 ml-2">
                Last synced {format(new Date(provider.last_synced_at), "d MMM yyyy, h:mm a")}
              </span>
            )}
          </>
        ) : (
          <>
            <span className="w-2 h-2 rounded-full bg-slate-300 inline-block" />
            <span className="text-sm text-slate-500">Not connected</span>
          </>
        )}
      </div>

      {/* Action buttons */}
      {isAdmin && (
        <div className="flex gap-2 mb-4">
          {!isConnected && !showFileForm && (
            <button
              onClick={handleConnect}
              disabled={connectMutation.isPending}
              className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {connectMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
              Connect OneDrive
            </button>
          )}

          {isConnected && (
            <>
              <button
                onClick={handleSync}
                disabled={syncMutation.isPending}
                className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md bg-slate-800 text-white hover:bg-slate-900 disabled:opacity-50"
              >
                {syncMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
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

      {/* File setup form */}
      {showFileForm && (
        <div className="bg-slate-50 border border-slate-200 rounded-md p-4 mb-4 space-y-3">
          <p className="text-sm font-medium text-slate-700">Paste your OneDrive spreadsheet URL</p>
          <input
            type="text"
            placeholder="https://onedrive.live.com/..."
            value={fileUrl}
            onChange={(e) => setFileUrl(e.target.value)}
            className="w-full text-sm border border-slate-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500 whitespace-nowrap">Sheet name:</label>
            <input
              type="text"
              value={sheetName}
              onChange={(e) => setSheetName(e.target.value)}
              className="text-sm border border-slate-300 rounded px-3 py-1.5 w-32 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleSaveFile}
              disabled={saveMutation.isPending || !fileUrl.trim()}
              className="ml-auto text-sm px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saveMutation.isPending ? "Saving..." : "Save & Connect"}
            </button>
          </div>
        </div>
      )}

      {/* Sync result message */}
      {syncMessage && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2 mb-4">
          {syncMessage}
        </p>
      )}

      {syncMutation.isError && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2 mb-4">
          Sync failed: {syncMutation.error.message}
        </p>
      )}

      {/* Sync history */}
      {isConnected && (
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Recent Syncs</p>
          {logsLoading ? (
            <p className="text-xs text-slate-400">Loading...</p>
          ) : logs.length === 0 ? (
            <p className="text-xs text-slate-400">No syncs yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {logs.slice(0, 5).map((log) => (
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
