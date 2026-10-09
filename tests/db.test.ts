import { afterEach, describe, it, expect } from "vitest";
import {
  db,
  saveTrip,
  saveEntry,
  deleteEntry,
  deleteTrip,
  TravelDB,
} from "../src/db";
import { newTrip, budget, type Entry } from "../src/model";
afterEach(async () => {
  await db.attachments.clear();
  await db.entries.clear();
  await db.trips.clear();
});
const trip = () => ({
  ...newTrip(),
  name: "China",
  countries: "China",
  start: "2026-10-31",
  end: "2026-11-14",
  cities: [{ id: "sh", name: "Shanghai" }],
});
describe("durable local storage", () => {
  it("keeps a single linked expense across repeated saves, and removes its files atomically", async () => {
    const t = trip();
    await saveTrip(t);
    const e: Entry = {
      id: "hotel",
      tripId: t.id,
      kind: "hotel",
      name: "Stay",
      cityId: "sh",
      date: t.start,
      endDate: t.end,
      amount: "100",
      currency: "AED",
      status: "Planned",
    };
    await saveEntry(
      e,
      [
        {
          id: "file",
          tripId: t.id,
          entryId: e.id,
          name: "ticket.pdf",
          type: "application/pdf",
          blob: new Blob(["document"], { type: "application/pdf" }),
        },
      ],
      [],
    );
    await saveEntry({ ...e, amount: "200" }, [], []);
    expect(budget(await db.entries.toArray(), {}).total).toBe("200.00");
    expect(await db.entries.count()).toBe(1);
    db.close();
    await db.open();
    expect((await db.attachments.get("file"))?.blob.size).toBe(8);
    await deleteEntry(e.id);
    expect(await db.attachments.count()).toBe(0);
    expect(budget(await db.entries.toArray(), {}).total).toBe("0.00");
  });
  it("rolls back an invalid change without losing an attachment", async () => {
    const t = trip();
    await saveTrip(t);
    const e: Entry = {
      id: "hotel",
      tripId: t.id,
      kind: "hotel",
      name: "Stay",
      cityId: "sh",
      date: t.start,
      endDate: t.end,
    };
    await saveEntry(
      e,
      [
        {
          id: "file",
          tripId: t.id,
          entryId: e.id,
          name: "a.pdf",
          type: "application/pdf",
          blob: new Blob(["a"]),
        },
      ],
      [],
    );
    await expect(saveEntry({ ...e, name: "" }, [], ["file"])).rejects.toThrow();
    expect(await db.attachments.count()).toBe(1);
    expect((await db.entries.get(e.id))?.name).toBe("Stay");
  });
  it("deletes only the selected trip and its contents", async () => {
    const a = trip(),
      b = trip();
    await saveTrip(a);
    await saveTrip(b);
    await saveEntry(
      {
        id: "expense",
        tripId: a.id,
        kind: "expense",
        name: "Lunch",
        amount: "10",
        currency: "AED",
      },
      [],
      [],
    );
    await deleteTrip(a.id);
    expect(await db.trips.count()).toBe(1);
    expect(await db.trips.get(b.id)).toBeDefined();
    expect(await db.entries.count()).toBe(0);
  });
  it("retains version-one data during an additive future migration", async () => {
    const name = "migration-test";
    const old = new TravelDB(name);
    const t = trip();
    await old.trips.put(t);
    await old.attachments.put({
      id: "a",
      tripId: t.id,
      entryId: "e",
      name: "a.pdf",
      type: "application/pdf",
      blob: new Blob(["original"]),
    });
    old.close();
    const next = new TravelDB(name);
    next.version(2).stores({ trips: "id,start" });
    await next.open();
    expect((await next.trips.get(t.id))?.name).toBe("China");
    expect((await next.attachments.get("a"))?.blob.size).toBe(8);
    await next.delete();
  });
});
