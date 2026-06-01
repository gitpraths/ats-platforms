import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import Training from "./Training";

const listMock = vi.fn();
const getMock  = vi.fn();
const postMock = vi.fn();

vi.mock("../lib/api", () => ({
  api: {
    list: (path: string) => listMock(path),
    get:  (path: string) => getMock(path),
    post: (path: string, body: unknown) => postMock(path, body),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <Training />
      </QueryClientProvider>
    </MemoryRouter>
  );
}

const baseListResponse = (rows: unknown[], total = rows.length) => ({
  data: rows,
  meta: { total, page: 1, limit: 25 },
});

beforeEach(() => {
  vi.clearAllMocks();

  listMock.mockImplementation(async (path: string) => {
    if (path.startsWith("/trainings")) {
      return baseListResponse([
        { id: "t1", name: "White Card", code: "CPCWHS", description: null, duration_days: 1, provider_id: null, provider_name: null, is_active: true, created_at: "", updated_at: "" },
        { id: "t2", name: "Cert III in Aged Care", code: "CHC33015", description: null, duration_days: 180, provider_id: null, provider_name: null, is_active: true, created_at: "", updated_at: "" },
      ]);
    }
    if (path.startsWith("/providers")) {
      return baseListResponse([]);
    }
    if (path.startsWith("/candidate-trainings")) {
      const hasStatusFilter = path.includes("status=in_progress");
      return baseListResponse(hasStatusFilter ? [] : [
        {
          id: "ct1", candidate_id: "c1", training_id: "t1",
          status: "enrolled", start_date: "2026-07-01", end_date: null,
          completed_at: null, certificate_no: null, notes: null,
          created_by: null, created_at: "", updated_at: "",
          training_name: "White Card", training_code: "CPCWHS",
          provider_name: null, candidate_name: "Alice",
        },
      ]);
    }
    if (path.startsWith("/candidates")) {
      return baseListResponse([
        { id: "c1", name: "Alice", email: "a@x" },
        { id: "c2", name: "Bob",   email: "b@x" },
      ]);
    }
    return baseListResponse([]);
  });

  getMock.mockImplementation(async (path: string) => {
    if (path.startsWith("/candidate-trainings/stats")) {
      return { enrolled: 5, in_progress: 2, completed: 3, withdrawn: 0, failed: 1 };
    }
    return null;
  });
});

describe("Training — Enrolments tab", () => {
  it("renders enrolment rows and summary chips", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Alice")).toBeInTheDocument());
    // "White Card" appears in both the row cell and the courses <option>, so use getAllByText.
    expect(screen.getAllByText("White Card").length).toBeGreaterThan(0);
    expect(screen.getByText(/enrolled: 5/i)).toBeInTheDocument();
    expect(screen.getByText(/in progress: 2/i)).toBeInTheDocument();
  });

  it("applies a status chip filter and shows the empty state when no rows match", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByText("Alice")).toBeInTheDocument());

    // First "in progress" hit is the chip toggle in the filter bar (not the summary chip).
    const inProgressChips = screen.getAllByRole("button", { name: /in progress/i });
    await user.click(inProgressChips[0]);

    await waitFor(() => expect(screen.getByText(/no enrolments match/i)).toBeInTheDocument());
  });
});

describe("Training — Cohort enrol tab", () => {
  it("disables the submit button until course, date, and a candidate are picked", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("tab", { name: /cohort enrol/i }));

    const submit = await screen.findByRole("button", { name: /enrol 0 candidates/i });
    expect(submit).toBeDisabled();

    // Pick course
    const courseSelect = await screen.findByRole("combobox", { name: undefined });
    fireEvent.change(courseSelect, { target: { value: "t2" } });

    // Set start date via its associated label
    fireEvent.change(screen.getByLabelText(/start date/i), { target: { value: "2026-07-01" } });

    // Select a candidate
    await waitFor(() => expect(screen.getByText("Alice")).toBeInTheDocument());
    const aliceCheckbox = screen.getByRole("checkbox", { name: /alice/i });
    await user.click(aliceCheckbox);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /enrol 1 candidate/i })).toBeEnabled();
    });
  });

  it("surfaces skipped candidates from the bulk response", async () => {
    postMock.mockResolvedValueOnce({
      created: [],
      skipped: [{ candidate_id: "c1", reason: "active_enrolment_exists" }],
    });

    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("tab", { name: /cohort enrol/i }));

    const courseSelect = await screen.findByRole("combobox", { name: undefined });
    fireEvent.change(courseSelect, { target: { value: "t2" } });
    fireEvent.change(screen.getByLabelText(/start date/i), { target: { value: "2026-07-01" } });

    await waitFor(() => expect(screen.getByText("Alice")).toBeInTheDocument());
    await user.click(screen.getByRole("checkbox", { name: /alice/i }));

    await user.click(screen.getByRole("button", { name: /enrol 1 candidate/i }));

    await waitFor(() => expect(screen.getByText(/bulk enrolment complete/i)).toBeInTheDocument());
    expect(screen.getByText(/1 skipped/i)).toBeInTheDocument();
  });
});
