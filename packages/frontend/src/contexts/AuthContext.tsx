import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { api } from "../lib/api";
import type { User } from "../types";

interface AuthContextValue {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setToken: (token: string) => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]           = useState<User | null>(null);
  const [token, setTokenState]    = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ✅ Always keep localStorage in sync with React token state
  function setToken(newToken: string | null) {
    if (newToken) {
      localStorage.setItem("token", newToken);
    } else {
      localStorage.removeItem("token");
    }
    setTokenState(newToken);
  }

  useEffect(() => {
    const stored = localStorage.getItem("token");
    if (stored) {
      setTokenState(stored);
      api.get<User>("/users/me")
        .then(setUser)
        .catch(() => { localStorage.removeItem("token"); })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  async function login(email: string, password: string) {
    const data = await api.post<{ token: string; user: User }>("/auth/login", { email, password });
    setToken(data.token);
    setUser(data.user);
  }

  function logout() {
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, setToken, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
