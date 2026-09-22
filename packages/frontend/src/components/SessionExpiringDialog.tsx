import { useEffect, useState, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../lib/api";

// How many ms before expiry to show the warning (5 minutes)
const WARN_BEFORE_MS = 5 * 60 * 1000;
// Poll interval to check expiry (1 minute)
const CHECK_INTERVAL_MS = 60 * 1000;

function getTokenExpiry(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.exp ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

export default function SessionExpiringDialog() {
  const { token, setToken, logout } = useAuth();
  const [show, setShow]             = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const checkExpiry = useCallback(() => {
    if (!token) return;
    const expiry = getTokenExpiry(token);
    if (!expiry) return;
    const msLeft = expiry - Date.now();
    if (msLeft > 0 && msLeft <= WARN_BEFORE_MS) setShow(true);
    else if (msLeft <= 0) { logout(); }
    else { setShow(false); } // token is valid and not near expiry — hide dialog
  }, [token, logout]);

  useEffect(() => {
    checkExpiry();
    const interval = setInterval(checkExpiry, CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [checkExpiry]);

  async function handleRefresh() {
    setRefreshing(true);
    setError(null);
    try {
      const data = await api.get<{ token: string }>("/session/refresh");
      // ✅ Fix: Save to localStorage so api.ts picks up the new token immediately
      localStorage.setItem("token", data.token);
      setToken(data.token);
      setShow(false);
    } catch {
      setError("Could not extend session. Please try again or sign in again.");
    } finally {
      setRefreshing(false);
    }
  }

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
        <h3 className="font-semibold text-gray-900 mb-2">Session expiring soon</h3>
        <p className="text-sm text-gray-500 mb-4">
          Your session will expire in less than 5 minutes. Extend it to keep working.
        </p>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 rounded-lg disabled:opacity-50 transition-colors"
          >
            {refreshing ? "Extending..." : "Extend Session"}
          </button>
          <button
            onClick={logout}
            className="flex-1 border text-sm text-gray-600 hover:bg-gray-50 py-2 rounded-lg transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
