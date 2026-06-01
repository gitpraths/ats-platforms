import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import AdminTrainings from "./AdminTrainings";

vi.mock("../lib/api", () => ({
  api: {
    list: vi.fn(async (path: string) => {
      if (path.startsWith("/trainings")) {
        return {
          data: [
            { id: "t1", name: "White Card", code: "CPCWHS", description: null, duration_days: 1, provider_id: null, provider_name: null, is_active: true, created_at: "", updated_at: "" },
          ],
          meta: { total: 1, page: 1, limit: 100 },
        };
      }
      if (path.startsWith("/providers")) {
        return { data: [], meta: { total: 0, page: 1, limit: 200 } };
      }
      return { data: [], meta: { total: 0, page: 1, limit: 20 } };
    }),
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u1", role: "admin", name: "Admin", email: "a@b" } }),
}));

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <AdminTrainings />
      </QueryClientProvider>
    </MemoryRouter>
  );
}

beforeEach(() => { vi.clearAllMocks(); });

describe("AdminTrainings", () => {
  it("renders training rows from the catalogue", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("White Card")).toBeInTheDocument());
    expect(screen.getByText("CPCWHS")).toBeInTheDocument();
  });

  it("shows 'New Training' button for admin role", async () => {
    renderPage();
    expect(await screen.findByRole("button", { name: /new training/i })).toBeInTheDocument();
  });
});
