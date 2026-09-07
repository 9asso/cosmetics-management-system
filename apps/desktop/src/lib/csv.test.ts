import { describe, expect, it, vi } from "vitest";
import { allPages, csvContent } from "./csv";
describe("complete, spreadsheet-safe CSV export", () => {
  it("escapes quotes, separators and formula-like contact fields", () => {
    const csv = csvContent([
      ['=HYPERLINK("bad")', " +SUM(1;2)", "normal;cell", '"quoted"', 12.5, -2],
    ]);
    expect(csv).toContain('"\'=HYPERLINK(""bad"")"');
    expect(csv).toContain('"\' +SUM(1;2)"');
    expect(csv).toContain('"normal;cell"');
    expect(csv).toContain('"-2"');
    expect(csv.startsWith("\uFEFF")).toBe(true);
  });
  it("exports every page, including a partial last page", async () => {
    const fetch = vi.fn(async (page: number) => ({
      items: page === 1 ? [1, 2] : [3],
      total: 3,
      page,
      pageSize: 2,
    }));
    expect(await allPages(fetch)).toEqual([1, 2, 3]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("does not silently export incomplete data after a failed page", async () => {
    await expect(
      allPages(async (page) => {
        if (page === 2) throw new Error("Offline");
        return { items: [1], page, pageSize: 1, total: 2 };
      }),
    ).rejects.toThrow("Offline");
  });
});
