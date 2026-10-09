import Decimal from "decimal.js";
export type Kind = "place" | "hotel" | "transport" | "expense";
export type Status = "Planned" | "Paid";
export interface City {
  id: string;
  name: string;
}
export interface Stay {
  id: string;
  cityId: string;
  start: string;
  end: string;
}
export interface Category {
  id: string;
  name: string;
}
export interface Trip {
  id: string;
  name: string;
  countries: string;
  start: string;
  end: string;
  cover?: Blob;
  cities: City[];
  stays: Stay[];
  categories: Category[];
  rates: Record<string, string>;
}
export interface Entry {
  id: string;
  tripId: string;
  kind: Kind;
  name: string;
  cityId?: string;
  category?: string;
  address?: string;
  localName?: string;
  localAddress?: string;
  url?: string;
  notes?: string;
  amount?: string;
  currency?: string;
  status?: Status;
  date?: string;
  endDate?: string;
  time?: string;
  endTime?: string;
  order?: number;
  visited?: boolean;
  booking?: string;
  transportType?: string;
  origin?: string;
  destination?: string;
  company?: string;
  number?: string;
}
export interface Attachment {
  id: string;
  tripId: string;
  entryId: string;
  name: string;
  type: string;
  blob: Blob;
}
export const placeCategories = [
  "Food",
  "Shopping",
  "Museums",
  "Viewpoints",
  "Walks",
  "Other",
];
export const budgetCategories = [
  "Accommodation",
  "Transport",
  "Food",
  "Shopping",
  "Activities",
  "Other",
];
export const uid = () => crypto.randomUUID();
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export function newTrip(): Trip {
  return {
    id: uid(),
    name: "",
    countries: "",
    start: "",
    end: "",
    cities: [],
    stays: [],
    categories: placeCategories.map((name) => ({ id: uid(), name })),
    rates: { AED: "1" },
  };
}
export const prettyDate = (d?: string) =>
  d
    ? new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
      }).format(new Date(d + "T12:00:00"))
    : "Not scheduled";
export const validDate = (s: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  !Number.isNaN(Date.parse(s + "T12:00:00")) &&
  new Date(s + "T12:00:00Z").toISOString().slice(0, 10) === s;
export function shiftDay(day: string, n: number) {
  const d = new Date(day + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export const money = (s: string | number) => new Decimal(s).toFixed(2);
export function positive(s: string, zero = false) {
  try {
    const d = new Decimal(s);
    return d.isFinite() && (zero ? d.gte(0) : d.gt(0));
  } catch {
    return false;
  }
}
export function budget(entries: Entry[], rates: Record<string, string>) {
  const rows = entries
    .filter(
      (e) => e.kind !== "place" && e.amount !== undefined && e.amount !== "",
    )
    .map((e) => {
      const currency = e.currency || "AED";
      const rate = currency === "AED" ? "1" : rates[currency];
      return {
        ...e,
        category:
          e.kind === "hotel"
            ? "Accommodation"
            : e.kind === "transport"
              ? "Transport"
              : e.category || "Other",
        aed:
          rate && positive(rate)
            ? new Decimal(e.amount!)
                .mul(rate)
                .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
                .toFixed(2)
            : null,
      };
    });
  const sum = (items: typeof rows) =>
    items.reduce((a, e) => a.plus(e.aed || 0), new Decimal(0)).toFixed(2);
  return {
    rows,
    total: sum(rows),
    paid: sum(rows.filter((e) => e.status === "Paid")),
    planned: sum(rows.filter((e) => e.status !== "Paid")),
    missing: [
      ...new Set(
        rows.filter((e) => e.aed === null).map((e) => e.currency || "AED"),
      ),
    ],
    categories: budgetCategories.map((name) => ({
      name,
      amount: sum(rows.filter((e) => e.category === name)),
    })),
  };
}
export function tripError(t: Trip, entries: Entry[]) {
  if (!t.name.trim() || !t.countries.trim())
    return "Add a trip name and country.";
  if (!validDate(t.start) || !validDate(t.end) || t.end < t.start)
    return "Choose valid trip dates, with the end on or after the start.";
  if (t.cities.some((c) => !c.name.trim())) return "Give each city a name.";
  if (
    t.stays.some(
      (s) =>
        !t.cities.some((c) => c.id === s.cityId) ||
        !validDate(s.start) ||
        !validDate(s.end) ||
        s.end < s.start ||
        s.start < t.start ||
        s.end > t.end,
    )
  )
    return "Each stay needs a city and valid dates within this trip.";
  if (
    entries.some(
      (e) =>
        (e.cityId && !t.cities.some((c) => c.id === e.cityId)) ||
        (e.date && (e.date < t.start || e.date > t.end)) ||
        (e.endDate && (e.endDate < t.start || e.endDate > t.end)),
    )
  )
    return "Existing records use a removed city or dates outside this range. Update those records first; nothing has been deleted.";
  return "";
}
export function entryError(e: Entry, t: Trip) {
  if (!e.name.trim()) return "Add a name.";
  if (
    (e.kind === "place" || e.kind === "hotel") &&
    !t.cities.some((c) => c.id === e.cityId)
  )
    return "Choose a city. Add cities in Edit trip first.";
  if (e.amount !== undefined && e.amount !== "" && !positive(e.amount, true))
    return "Enter a valid amount of zero or more.";
  if (e.kind === "expense" && !e.amount) return "Enter the expense amount.";
  if (e.amount && !/^[A-Z]{3}$/.test(e.currency || ""))
    return "Use a three-letter currency code, such as AED or CNY.";
  if ((e.kind === "hotel" || e.kind === "transport") && (!e.date || !e.endDate))
    return "Add both dates.";
  for (const d of [e.date, e.endDate])
    if (d && (!validDate(d) || d < t.start || d > t.end))
      return "Choose dates within the trip.";
  if (e.kind === "hotel" && e.date && e.endDate && e.endDate <= e.date)
    return "Check-out must be after check-in.";
  if (
    e.kind === "transport" &&
    (!e.origin?.trim() || !e.destination?.trim() || !e.time || !e.endTime)
  )
    return "Add departure and arrival points and local times.";
  if (e.kind === "place" && (e.time || e.endTime) && !e.date)
    return "Choose a day before adding a time.";
  if (e.kind === "place" && e.time && e.endTime && e.endTime < e.time)
    return "The visit end time must follow its start time.";
  if (e.url) {
    try {
      if (!["http:", "https:"].includes(new URL(e.url).protocol))
        return "Use an http or https link.";
    } catch {
      return "Enter a complete link starting with https://.";
    }
  }
  return "";
}
export function fileError(file: File) {
  if (
    !["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(
      file.type,
    )
  )
    return `${file.name}: choose PDF, JPEG, PNG or WebP.`;
  if (file.size > 20 * 1024 * 1024)
    return `${file.name}: maximum size is 20 MB.`;
  return "";
}
export function reordered(entries: Entry[], id: string, direction: number) {
  const sorted = [...entries].sort(
    (a, b) => (a.order || 0) - (b.order || 0) || a.id.localeCompare(b.id),
  );
  const i = sorted.findIndex((e) => e.id === id);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= sorted.length) return sorted;
  [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
  return sorted.map((e, order) => ({ ...e, order }));
}
