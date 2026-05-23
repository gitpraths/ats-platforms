import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search, MapPin, Mail } from "lucide-react";
import { api } from "../lib/api";
import type { Candidate } from "../types";

export default function Candidates() {
  const navigate     = useNavigate();
  const [q, setQ]   = useState("");
  const [search, setSearch] = useState("");
  const [searchParams] = useSearchParams();
  const initialProvider = searchParams.get("provider_id") ?? "";
  const [providerFilter] = useState(initialProvider);

  const { data: candidates = [], isLoading } = useQuery<Candidate[]>({
    queryKey: ["candidates", search, providerFilter],
    queryFn:  () => {
      const params = new URLSearchParams({
        page: "1",
        limit: "20",
        q: search,
      });
      if (providerFilter) params.set("provider_id", providerFilter);
      return api.get<Candidate[]>(`/candidates?${params}`);
    },
  });

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(q);
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">Candidates</h1>
        <button
          onClick={() => navigate("/candidates/new")}
          className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          + Add Candidate
        </button>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button type="submit" className="px-4 py-2 bg-slate-100 hover:bg-slate-100 rounded-lg text-sm font-medium">
          Search
        </button>
      </form>

      {isLoading ? (
        <p className="text-slate-500">Loading...</p>
      ) : candidates.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-slate-400">No candidates found.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {candidates.map((c) => (
            <button
              key={c.id}
              onClick={() => navigate(`/candidates/${c.id}`)}
              className="bg-white rounded-xl shadow-sm p-4 text-left hover:shadow-md transition"
            >
              {/* Avatar initials */}
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full border border-blue-400 text-blue-600 bg-transparent flex items-center justify-center font-bold text-sm flex-shrink-0">
                  {c.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 truncate">{c.name}</p>
                  <p className="text-xs text-slate-500 flex items-center gap-1 truncate">
                    <Mail size={11} />{c.email}
                  </p>
                </div>
              </div>

              {(c.city || c.state) && (
                <p className="text-xs text-slate-400 flex items-center gap-1 mb-2">
                  <MapPin size={11} />{[c.city, c.state].filter(Boolean).join(", ")}
                </p>
              )}

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  {c.application_count ?? 0} application{(c.application_count ?? 0) !== 1 ? "s" : ""}
                </span>
                {c.linkedin && (
                  <a
                    href={c.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs text-slate-600 hover:underline"
                  >
                    LinkedIn
                  </a>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
