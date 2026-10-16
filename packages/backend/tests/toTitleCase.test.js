import { toTitleCase } from "../src/utils/toTitleCase.js";

describe("toTitleCase utility", () => {
  it("formats all-caps names to Title Case", () => {
    expect(toTitleCase("GAKU MORIMOTO")).toBe("Gaku Morimoto");
    expect(toTitleCase("JOHN SMITH")).toBe("John Smith");
  });

  it("formats all-lowercase names to Title Case", () => {
    expect(toTitleCase("gaku morimoto")).toBe("Gaku Morimoto");
    expect(toTitleCase("warehouse storeperson")).toBe("Warehouse Storeperson");
  });

  it("handles apostrophes and hyphenated names", () => {
    expect(toTitleCase("O'CONNOR")).toBe("O'Connor");
    expect(toTitleCase("o'connor")).toBe("O'Connor");
    expect(toTitleCase("D'ARCY")).toBe("D'Arcy");
    expect(toTitleCase("SMITH-JONES")).toBe("Smith-Jones");
  });

  it("handles Scottish Mc prefix and Roman numerals", () => {
    expect(toTitleCase("MCDONALD")).toBe("McDonald");
    expect(toTitleCase("CERTIFICATE III IN WAREHOUSING")).toBe("Certificate III In Warehousing");
    expect(toTitleCase("STAGE IV LEADERSHIP")).toBe("Stage IV Leadership");
  });

  it("handles null, undefined and empty strings safely", () => {
    expect(toTitleCase("")).toBe("");
    expect(toTitleCase(null)).toBe("");
    expect(toTitleCase(undefined)).toBe("");
  });
});
