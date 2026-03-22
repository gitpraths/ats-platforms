const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

function getToken() {
  return localStorage.getItem("token");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || "Request failed");
  }
  return json.data as T;
}

export const api = {
  get:    <T>(path: string)                              => request<T>(path),
  post:   <T>(path: string, body: unknown)               => request<T>(path, { method: "POST",   body: JSON.stringify(body) }),
  put:    <T>(path: string, body: unknown)               => request<T>(path, { method: "PUT",    body: JSON.stringify(body) }),
  patch:  <T>(path: string, body: unknown)               => request<T>(path, { method: "PATCH",  body: JSON.stringify(body) }),
  delete: <T>(path: string, body?: unknown)              => request<T>(path, { method: "DELETE", ...(body ? { body: JSON.stringify(body) } : {}) }),
};
