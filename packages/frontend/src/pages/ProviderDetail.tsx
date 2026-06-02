import { useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Edit2, Users, Briefcase, UserCheck, UserX, UserCog } from "lucide-react";
import { api } from "../lib/api";
import type { Provider, Candidate, XeroContact } from "../types";
import { useAuth } from "../contexts/AuthContext";
import { useXeroContactSearch, useCreateXeroContact, useLinkProviderToXero } from "../hooks/useXero";
import { format } from "date-fns";
import SpreadsheetSyncPanel from "../components/SpreadsheetSyncPanel";

interface ProviderDetailData extends Provider {
  candidate_count: number;
  placed_count: number;
  job_seeking_count: number;
  employed_count: number;
  inactive_count: number;
  recent_candidates: Pick<Candidate, "id" | "name" | "work_status" | "created_at">[];
}

const WORK_STATUS_BADGE: Record<string, string> = {
  job_seeking: "border border-blue-400 text-blue-600 bg-transparent",
  employed:    "border border-green-500 text-green-700 bg-transparent",
  placed:      "border border-purple-400 text-purple-600 bg-transparent",
  inactive:    "border border-slate-400 text-slate-600 bg-transparent",
};

export default function ProviderDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin" || user?.role === "recruiter_admin";

  const { data: provider, isLoading } = useQuery<ProviderDetailData>({
    queryKey: ["provider", id],
    queryFn: () => api.get<ProviderDetailData>(`/providers/${id}`),
  });

  if (isLoading) return <p className="p-6 text-slate-500">Loading...</p>;
  if (!provider) return <p className="p-6 text-red-500">Provider not found.</p>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/providers" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft size={15} /> Back to Providers
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">{provider.name}</h1>
          <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium ${
            provider.is_active
              ? "border border-green-500 text-green-700 bg-transparent"
              : "border border-slate-400 text-slate-600 bg-transparent"
          }`}>
            {provider.is_active ? "Active" : "Inactive"}
          </span>
        </div>
        {isAdmin && (
          <button
            onClick={() => navigate(`/providers/${id}/edit`)}
            className="flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm hover:bg-slate-50"
          >
            <Edit2 size={14} /> Edit
          </button>
        )}
      </div>

      {/* Xero contact link */}
      {isAdmin && (
        <div className="mb-6">
          <XeroContactSection provider={{ id: provider.id, name: provider.name, xero_contact_id: provider.xero_contact_id ?? null }} />
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        {[
          { label: "Total Candidates",  value: provider.candidate_count ?? 0,   icon: <Users size={16} /> },
          { label: "Placed",            value: provider.placed_count ?? 0,       icon: <UserCheck size={16} /> },
          { label: "Job Seeking",       value: provider.job_seeking_count ?? 0,  icon: <Briefcase size={16} /> },
          { label: "Employed",          value: provider.employed_count ?? 0,     icon: <UserCog size={16} /> },
          { label: "Inactive",          value: provider.inactive_count ?? 0,     icon: <UserX size={16} /> },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center gap-2 text-slate-400 mb-1">{s.icon}
              <span className="text-xs font-medium">{s.label}</span>
            </div>
            <p className="text-2xl font-bold text-slate-900">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Info card */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h2 className="font-semibold text-slate-900 tracking-tight mb-4">Contact Information</h2>
        <dl className="grid sm:grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-xs font-medium text-slate-500 uppercase">Contact Name</dt>
            <dd className="mt-0.5 text-slate-900">{provider.contact_name || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500 uppercase">Email</dt>
            <dd className="mt-0.5 text-slate-900">{provider.email || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500 uppercase">Phone</dt>
            <dd className="mt-0.5 text-slate-900">{provider.phone || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500 uppercase">Address</dt>
            <dd className="mt-0.5 text-slate-900">{provider.address || "—"}</dd>
          </div>
        </dl>
      </div>

      {/* Recent candidates */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-900 tracking-tight">Recent Candidates</h2>
          <Link to={`/candidates?provider_id=${id}`} className="text-xs text-slate-600 hover:underline">
            View all
          </Link>
        </div>
        {!provider.recent_candidates?.length ? (
          <p className="text-sm text-slate-400">No candidates linked yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b">
                <th className="pb-2">Name</th>
                <th className="pb-2">Status</th>
                <th className="pb-2">Added</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {provider.recent_candidates.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 cursor-pointer"
                  onClick={() => navigate(`/candidates/${c.id}`)}>
                  <td className="py-2 font-medium text-slate-900">{c.name}</td>
                  <td className="py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${WORK_STATUS_BADGE[c.work_status ?? "job_seeking"]}`}>
                      {c.work_status?.replace("_", " ") ?? "job seeking"}
                    </span>
                  </td>
                  <td className="py-2 text-slate-500">{format(new Date(c.created_at), "MMM d, yyyy")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Spreadsheet Sync */}
      <SpreadsheetSyncPanel provider={provider} isAdmin={isAdmin} />
    </div>
  );
}

function XeroContactSection({ provider }: { provider: { id: string; name: string; xero_contact_id: string | null } }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(provider.name);
  const link = useLinkProviderToXero();
  const create = useCreateXeroContact();
  const { data: searchResult, isFetching } = useXeroContactSearch(open ? search : "");
  const matches = searchResult?.data ?? [];

  if (provider.xero_contact_id && !open) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="text-slate-500">Xero contact:</span>
        <code className="text-xs text-slate-700">{provider.xero_contact_id}</code>
        <button onClick={() => setOpen(true)} className="text-xs text-slate-400 hover:underline">change</button>
        <button onClick={() => link.mutate({ providerId: provider.id, xero_contact_id: null })}
                className="text-xs text-red-500 hover:underline">unlink</button>
      </div>
    );
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-xs text-slate-500 hover:underline">
        Link to Xero contact
      </button>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 max-w-md">
      <div className="flex items-center gap-2 mb-2">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search Xero contacts..."
               className="flex-1 border border-slate-200 rounded px-2 py-1 text-sm" />
        <button onClick={() => setOpen(false)} className="text-xs text-slate-400 hover:underline">close</button>
      </div>
      {isFetching && <p className="text-xs text-slate-400">Searching...</p>}
      <ul className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
        {matches.map((c: XeroContact) => (
          <li key={c.contact_id}>
            <button onClick={() => link.mutate({ providerId: provider.id, xero_contact_id: c.contact_id }, { onSuccess: () => setOpen(false) })}
                    className="w-full text-left px-2 py-1.5 text-sm hover:bg-slate-50">
              <div className="text-slate-900">{c.name}</div>
              {c.email && <div className="text-xs text-slate-400">{c.email}</div>}
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-2 pt-2 border-t border-slate-100">
        <button
          onClick={() => create.mutateAsync({ name: provider.name })
            .then((c) => link.mutateAsync({ providerId: provider.id, xero_contact_id: c.contact_id }))
            .then(() => setOpen(false))}
          disabled={create.isPending || link.isPending}
          className="text-xs text-blue-600 hover:underline disabled:opacity-50"
        >
          Create new Xero contact "{provider.name}"
        </button>
      </div>
    </div>
  );
}
