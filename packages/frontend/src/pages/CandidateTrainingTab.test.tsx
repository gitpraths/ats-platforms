import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { TrainingTab } from "./CandidateDetail";

vi.mock("../lib/api", () => ({
  api: {
    get: vi.fn(async (path: string) => {
      if (path.endsWith("/trainings")) {
        return [
          {
            id: "ct1", candidate_id: "c1", training_id: "t1",
            status: "in_progress", start_date: "2026-05-01", end_date: "2026-09-30",
            completed_at: null, certificate_no: null, notes: null,
            created_by: null, created_at: "", updated_at: "",
            training_name: "Cert III in Aged Care", training_code: "CHC33015",
            provider_name: "Maxima Training",
          },
        ];
      }
      return null;
    }),
    list: vi.fn(async () => ({ data: [], meta: { total: 0, page: 1, limit: 200 } })),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("TrainingTab", () => {
  it("renders enrolment rows from the API", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <MemoryRouter>
        <QueryClientProvider client={qc}>
          <TrainingTab candidateId="c1" canWrite />
        </QueryClientProvider>
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText("Cert III in Aged Care")).toBeInTheDocument());
    expect(screen.getByText("in progress")).toBeInTheDocument();
  });
});
