import Dexie, { type Table } from "dexie";
import {
  type Trip,
  type Entry,
  type Attachment,
  entryError,
  tripError,
} from "./model";
export class TravelDB extends Dexie {
  trips!: Table<Trip, string>;
  entries!: Table<Entry, string>;
  attachments!: Table<Attachment, string>;
  constructor(name = "travel-planner-v1") {
    super(name);
    this.version(1).stores({
      trips: "id",
      entries: "id,tripId,kind",
      attachments: "id,tripId,entryId",
    });
  }
}
export const db = new TravelDB();
export async function saveTrip(t: Trip) {
  return db.transaction("rw", db.trips, db.entries, async () => {
    const error = tripError(
      t,
      await db.entries.where("tripId").equals(t.id).toArray(),
    );
    if (error) throw new Error(error);
    await db.trips.put(t);
  });
}
export async function saveEntry(
  e: Entry,
  added: Attachment[],
  removed: string[],
) {
  return db.transaction(
    "rw",
    db.trips,
    db.entries,
    db.attachments,
    async () => {
      const t = await db.trips.get(e.tripId);
      if (!t) throw new Error("This trip no longer exists.");
      const error = entryError(e, t);
      if (error) throw new Error(error);
      await db.entries.put(e);
      await db.attachments.bulkDelete(removed);
      await db.attachments.bulkPut(added);
    },
  );
}
export async function deleteEntry(id: string) {
  return db.transaction("rw", db.entries, db.attachments, async () => {
    await db.attachments.where("entryId").equals(id).delete();
    await db.entries.delete(id);
  });
}
export async function deleteTrip(id: string) {
  return db.transaction(
    "rw",
    db.trips,
    db.entries,
    db.attachments,
    async () => {
      await db.attachments.where("tripId").equals(id).delete();
      await db.entries.where("tripId").equals(id).delete();
      await db.trips.delete(id);
    },
  );
}
export function storageError(e: unknown) {
  return e instanceof Error && /quota/i.test(e.name + " " + e.message)
    ? "Your device storage is full. Free some space and try again. Your form has been kept."
    : e instanceof Error
      ? e.message
      : "Could not save. Your form has been kept. Please try again.";
}
