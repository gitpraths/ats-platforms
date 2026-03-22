import { useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Shield } from "lucide-react";
import { format } from "date-fns";
import { api } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import type { User } from "../types";

const BASE_URL = import.meta.env.VITE_API_URL?.replace("/api", "") || "http://localhost:3001";

const ROLE_BADGE: Record<string, string> = {
  admin:           "bg-red-100 text-red-700",
  recruiter_admin: "bg-orange-100 text-orange-700",
  hiring_manager:  "bg-purple-100 text-purple-700",
  recruiter:       "bg-blue-100 text-blue-700",
  user:            "bg-gray-100 text-gray-600",
};

export default function Profile() {
  const { user: authUser } = useAuth();
  const queryClient        = useQueryClient();
  const fileRef            = useRef<HTMLInputElement>(null);

  const { data: user } = useQuery<User>({
    queryKey: ["me"],
    queryFn:  () => api.get<User>("/users/me"),
  });

  const [name, setName]       = useState(user?.name ?? "");
  const [saved, setSaved]     = useState(false);
  const [error, setError]     = useState("");
  const [preview, setPreview] = useState<string | null>(null);

  const updateProfile = useMutation({
    mutationFn: () => api.put("/users/me", { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
    onError: (err: Error) => setError(err.message),
  });

  const uploadAvatar = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append("avatar", file);
      return fetch(`${BASE_URL}/api/users/${authUser!.id}/avatar`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: form,
      }).then((r) => r.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me"] });
      setPreview(null);
    },
  });

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    uploadAvatar.mutate(file);
  }

  const displayName  = user?.name ?? authUser?.name ?? "";
  const avatarSrc    = preview ?? (user?.avatar_url ? `${BASE_URL}${user.avatar_url}` : null);
  const initials     = displayName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">My Profile</h1>

      {/* Avatar */}
      <div className="bg-white border rounded-xl p-6 mb-4 flex items-center gap-5">
        <div className="relative">
          {avatarSrc ? (
            <img src={avatarSrc} alt="avatar" className="w-20 h-20 rounded-full object-cover" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-2xl font-bold">
              {initials}
            </div>
          )}
          <button
            onClick={() => fileRef.current?.click()}
            className="absolute bottom-0 right-0 bg-white border rounded-full p-1.5 shadow hover:bg-gray-50"
          >
            <Camera size={14} />
          </button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden" onChange={onFileChange} />
        </div>
        <div>
          <p className="font-semibold text-gray-900 text-lg">{displayName}</p>
          <p className="text-sm text-gray-500">{user?.email}</p>
          <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_BADGE[user?.role ?? "user"]}`}>
            {user?.role?.replace("_", " ")}
          </span>
        </div>
      </div>

      {/* Edit form */}
      <div className="bg-white border rounded-xl p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Personal Info</h2>
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        {saved && <p className="mb-3 text-sm text-green-600">Changes saved.</p>}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input
              value={name || user?.name || ""}
              onChange={(e) => setName(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input value={user?.email ?? ""} readOnly
              className="w-full border rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-400 cursor-not-allowed" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <input value={user?.role?.replace("_", " ") ?? ""} readOnly
              className="w-full border rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-400 cursor-not-allowed" />
          </div>

          <button
            onClick={() => updateProfile.mutate()}
            disabled={updateProfile.isPending}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg transition disabled:opacity-50"
          >
            {updateProfile.isPending ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {/* Account Info */}
      <div className="bg-white border rounded-xl p-6 mt-4">
        <div className="flex items-center gap-2 mb-4">
          <Shield size={15} className="text-gray-400" />
          <h2 className="font-semibold text-gray-900">Account Info</h2>
        </div>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Member since</span>
            <span className="text-gray-800 font-medium">
              {user?.created_at ? format(new Date(user.created_at), "MMM d, yyyy") : "—"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Role</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${ROLE_BADGE[user?.role ?? "user"]}`}>
              {user?.role?.replace("_", " ") ?? "—"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">User ID</span>
            <span className="text-gray-400 font-mono text-xs truncate max-w-[220px]">{user?.id ?? "—"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
