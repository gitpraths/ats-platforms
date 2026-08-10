import { describe, it, expect } from "vitest";
import { validateNotBeforeApplied, toYYYYMMDD } from "./utils";

describe("toYYYYMMDD", () => {
  it("converts YYYY-MM-DD strings", () => {
    expect(toYYYYMMDD("2026-08-10")).toBe("2026-08-10");
    expect(toYYYYMMDD("2026-08-06T00:00:00.000Z")).toBe("2026-08-06");
  });

  it("converts DD/MM/YYYY strings", () => {
    expect(toYYYYMMDD("10/08/2026")).toBe("2026-08-10");
    expect(toYYYYMMDD("06/08/2026")).toBe("2026-08-06");
    expect(toYYYYMMDD("25/07/2026")).toBe("2026-07-25");
  });

  it("handles empty or invalid dates", () => {
    expect(toYYYYMMDD(null)).toBeNull();
    expect(toYYYYMMDD(undefined)).toBeNull();
    expect(toYYYYMMDD("")).toBeNull();
  });
});

describe("validateNotBeforeApplied", () => {
  it("allows same-day dates (targetDate === referenceAppliedDate)", () => {
    expect(validateNotBeforeApplied("2026-08-06", "2026-08-06")).toBeNull();
    expect(validateNotBeforeApplied("2026-08-10", "2026-08-10")).toBeNull();
    expect(validateNotBeforeApplied("06/08/2026", "06/08/2026")).toBeNull();
    expect(validateNotBeforeApplied("10/08/2026", "10/08/2026")).toBeNull();
  });

  it("allows dates after applied date (targetDate > referenceAppliedDate)", () => {
    expect(validateNotBeforeApplied("2026-08-10", "2026-08-06")).toBeNull();
    expect(validateNotBeforeApplied("10/08/2026", "06/08/2026")).toBeNull();
  });

  it("rejects dates before applied date (targetDate < referenceAppliedDate)", () => {
    expect(validateNotBeforeApplied("2026-07-25", "2026-08-06")).toBe("Date cannot be before Applied Date");
    expect(validateNotBeforeApplied("25/07/2026", "06/08/2026")).toBe("Date cannot be before Applied Date");
    expect(validateNotBeforeApplied("2026-08-05", "2026-08-06")).toBe("Date cannot be before Applied Date");
  });

  it("returns null if either targetDate or referenceAppliedDate is missing", () => {
    expect(validateNotBeforeApplied(null, "2026-08-06")).toBeNull();
    expect(validateNotBeforeApplied("2026-08-10", null)).toBeNull();
    expect(validateNotBeforeApplied(null, null)).toBeNull();
  });
});
