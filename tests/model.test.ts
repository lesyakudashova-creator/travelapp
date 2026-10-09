import { describe, it, expect } from "vitest";
import {
  budget,
  newTrip,
  tripError,
  entryError,
  reordered,
  shiftDay,
  fileError,
  type Entry,
} from "../src/model";
const trip = () => ({
  ...newTrip(),
  name: "China",
  countries: "China",
  start: "2026-10-31",
  end: "2026-11-14",
  cities: [{ id: "sh", name: "Shanghai" }],
});
const entry = (p: Partial<Entry> = {}): Entry => ({
  id: "e",
  tripId: "t",
  kind: "expense",
  name: "Lunch",
  amount: "10.10",
  currency: "CNY",
  status: "Planned",
  ...p,
});
describe("budget", () => {
  it("rounds each converted row, then totals, without binary floating point drift", () => {
    const b = budget(
      [entry({ id: "1", amount: "0.05" }), entry({ id: "2", amount: "0.05" })],
      { CNY: "0.5" },
    );
    expect(b.total).toBe("0.06");
    expect(b.planned).toBe("0.06");
  });
  it("moves the same amount between paid and planned", () => {
    const e = entry();
    const before = budget([e], { CNY: "0.51" });
    const after = budget([{ ...e, status: "Paid" }], { CNY: "0.51" });
    expect(before.total).toBe(after.total);
    expect(after.paid).toBe("5.15");
    expect(after.planned).toBe("0.00");
  });
  it("marks missing rates and ignores place estimates", () => {
    const b = budget(
      [entry(), entry({ id: "p", kind: "place", amount: "900" })],
      {},
    );
    expect(b.missing).toEqual(["CNY"]);
    expect(b.rows).toHaveLength(1);
    expect(b.rows[0].aed).toBeNull();
  });
  it("derives booking expenses and recalculates paid expenses on rate change", () => {
    const e = entry({ kind: "hotel", status: "Paid", amount: "100" });
    expect(budget([e], { CNY: "0.5" }).paid).toBe("50.00");
    const b = budget([e], { CNY: "0.6" });
    expect(b.paid).toBe("60.00");
    expect(b.rows[0].category).toBe("Accommodation");
  });
  it("always uses AED rate 1", () =>
    expect(budget([entry({ currency: "AED" })], { AED: "5" }).total).toBe(
      "10.10",
    ));
});
describe("dates and route integrity", () => {
  it("allows revisiting a city and overlapping travel days", () => {
    const t = trip();
    t.stays = [
      { id: "1", cityId: "sh", start: t.start, end: "2026-11-04" },
      { id: "2", cityId: "sh", start: "2026-11-04", end: t.end },
    ];
    expect(tripError(t, [])).toBe("");
  });
  it("blocks trip shortening and city deletion when records depend on them", () => {
    const e = entry({ date: "2026-11-14", cityId: "sh" });
    expect(tripError({ ...trip(), end: "2026-11-12" }, [e])).toContain(
      "Existing records",
    );
    expect(tripError({ ...trip(), cities: [] }, [e])).toContain(
      "Existing records",
    );
  });
  it("rejects impossible dates and zero-night hotels", () => {
    expect(tripError({ ...trip(), start: "2026-02-30" }, [])).not.toBe("");
    expect(
      entryError(
        entry({
          kind: "hotel",
          cityId: "sh",
          date: "2026-11-01",
          endDate: "2026-11-01",
        }),
        trip(),
      ),
    ).toContain("Check-out");
  });
  it("preserves ticket local times even when arrival clock is earlier", () => {
    expect(
      entryError(
        entry({
          kind: "transport",
          origin: "Tokyo",
          destination: "LA",
          date: "2026-11-01",
          endDate: "2026-11-01",
          time: "18:00",
          endTime: "11:00",
        }),
        trip(),
      ),
    ).toBe("");
  });
  it("advances across month and year boundaries", () => {
    expect(shiftDay("2026-10-31", 1)).toBe("2026-11-01");
    expect(shiftDay("2027-01-01", -1)).toBe("2026-12-31");
  });
  it("reorders places without losing or duplicating them", () => {
    const items = [
      entry({ id: "a", order: 0 }),
      entry({ id: "b", order: 1 }),
      entry({ id: "c", order: 2 }),
    ];
    expect(reordered(items, "b", -1).map((e) => e.id)).toEqual(["b", "a", "c"]);
    expect(reordered(items, "a", -1)).toHaveLength(3);
  });
  it("validates money and URLs", () => {
    expect(entryError(entry({ amount: "NaN" }), trip())).toContain(
      "valid amount",
    );
    expect(entryError(entry({ url: "javascript:alert(1)" }), trip())).toContain(
      "http",
    );
    expect(entryError(entry({ amount: "0", currency: "AED" }), trip())).toBe(
      "",
    );
  });
  it("rejects unsupported or oversized files", () => {
    expect(
      fileError(new File(["x"], "x.exe", { type: "application/octet-stream" })),
    ).toContain("choose PDF");
    expect(
      fileError({
        name: "big.pdf",
        type: "application/pdf",
        size: 21 * 1024 * 1024,
      } as File),
    ).toContain("20 MB");
  });
});
