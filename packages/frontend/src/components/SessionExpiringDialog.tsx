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
  const [show, setShow]         = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const checkExpiry = useCallback(() => {
    if (!token) return;
    const expiry = getTokenExpiry(token);
    if (!expiry) return;
    const msLeft = expiry - Date.now();
    if (msLeft > 0 && msLeft <= WARN_BEFORE_MS) setShow(true);
    else if (msLeft <= 0) { logout(); }
  }, [token, logout]);

  useEffect(() => {
    checkExpiry();
    const interval = setInterval(checkExpiry, CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [checkExpiry]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const data = await api.get<{ token: string }>("/session/refresh");
      setToken(data.token);
      setShow(false);
    } catch {
      logout();
    } finally {
      setRefreshing(false);
    }
  }

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
        <h3 className="font-semibold text-gray-900 mb-2">Session expiring soon</h3>
        <p className="text-sm text-gray-500 mb-5">
          Your session will expire in less than 5 minutes. Extend it to keep working.
        </p>
        <div className="flex gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 rounded-lg disabled:opacity-50"
          >
            {refreshing ? "Extending..." : "Extend Session"}
          </button>
          <button
            onClick={logout}
            className="flex-1 border text-sm text-gray-600 hover:bg-gray-50 py-2 rounded-lg"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
