import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2, AlertTriangle, Plug } from "lucide-react";
import {
  useXeroConnection, useXeroAuthUrl, useDisconnectXero,
} from "../hooks/useXero";
import { format } from "date-fns";

export default function AdminXero() {
  const [params, setParams] = useSearchParams();
  const { data: conn, isLoading } = useXeroConnection();
  const authUrl = useXeroAuthUrl();
  const disconnect = useDisconnectXero();
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => {
    if (params.get("connected") === "true") {
      setBanner("Successfully connected to Xero.");
      const next = new URLSearchParams(params); next.delete("connected"); setParams(next, { replace: true });
    }
    const err = params.get("error");
    if (err) {
      setBanner(`Xero connect failed: ${err}`);
      const next = new URLSearchParams(params); next.delete("error"); setParams(next, { replace: true });
    }
  }, [params, setParams]);

  function handleConnect() {
    authUrl.mutateAsync().then((res) => { window.location.href = res.url; });
  }

  function handleDisconnect() {
    if (!confirm("Disconnect MyATS from Xero? Existing invoice records stay in MyATS.")) return;
    disconnect.mutate();
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">Xero</h1>
        <p className="text-sm text-slate-500 mt-0.5">Manage the MyATS connection to Xero for invoicing.</p>
      </div>

      {banner && (
        <div className="mb-4 flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-sm text-blue-800">
          <AlertTriangle size={14} className="mt-0.5" />
          <span>{banner}</span>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm p-5">
        {isLoading ? (
          <p className="text-sm text-slate-500">Loading...</p>
        ) : conn ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-green-600" />
              <h2 className="font-semibold text-slate-900">Connected</h2>
            </div>
            <dl className="text-sm text-slate-600 space-y-1 mt-2">
              <div className="flex"><dt className="w-32 text-slate-400">Tenant</dt><dd>{conn.tenant_name || conn.tenant_id}</dd></div>
              <div className="flex"><dt className="w-32 text-slate-400">Connected by</dt><dd>{conn.connected_by_name || "—"}</dd></div>
              <div className="flex"><dt className="w-32 text-slate-400">Connected at</dt><dd>{format(new Date(conn.connected_at), "PPpp")}</dd></div>
            </dl>
            <div className="mt-4">
              <button
                onClick={handleDisconnect}
                className="text-xs text-red-600 hover:underline"
              >
                Disconnect
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 text-center py-6">
            <Plug className="mx-auto text-slate-400" />
            <h2 className="font-semibold text-slate-900">Not connected</h2>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              Connect MyATS to a Xero organisation to generate invoices from training enrolments.
              You'll need admin access on the Xero side.
            </p>
            <button
              onClick={handleConnect}
              disabled={authUrl.isPending}
              className="mt-2 px-4 py-2 text-sm rounded-lg bg-slate-800 text-white hover:bg-slate-900 disabled:opacity-50"
            >
              {authUrl.isPending ? "Loading..." : "Connect to Xero"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
