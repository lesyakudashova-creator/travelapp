import { useState, type FormEvent } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { saveTrip, saveEntry, storageError } from "./db";
import {
  type Trip,
  type Entry,
  type Attachment,
  type Kind,
  newTrip,
  uid,
  tripError,
  entryError,
  fileError,
  budgetCategories,
} from "./model";
import { Header, Field, Select, Note, Alert, Cover, go } from "./ui";

export function TripForm({
  initial,
  entries,
}: {
  initial?: Trip;
  entries: Entry[];
}) {
  const [t, set] = useState<Trip>(() =>
    initial ? structuredClone(initial) : newTrip(),
  );
  const [error, err] = useState("");
  const [busy, wait] = useState(false);
  const update = (p: Partial<Trip>) => set((v) => ({ ...v, ...p }));
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const problem = tripError(t, entries);
    if (problem) {
      err(problem);
      return;
    }
    wait(true);
    try {
      await saveTrip(t);
      go(t.id + "/overview");
    } catch (e) {
      err(storageError(e));
    } finally {
      wait(false);
    }
  };
  return (
    <main className="form-page">
      <Header
        title={initial ? "Edit trip" : "A new adventure"}
        sub="Make room for your next journey."
        back={() => go(initial ? initial.id + "/overview" : "")}
      />
      <form onSubmit={submit}>
        <Alert>{error}</Alert>
        <section className="card form-section">
          <h2>The essentials</h2>
          <Field
            label="Trip name"
            required
            value={t.name}
            onChange={(e) => update({ name: e.target.value })}
          />
          <Field
            label="Country or countries"
            required
            value={t.countries}
            onChange={(e) => update({ countries: e.target.value })}
          />
          <div className="two">
            <Field
              label="Start date"
              type="date"
              required
              value={t.start}
              onChange={(e) => update({ start: e.target.value })}
            />
            <Field
              label="End date"
              type="date"
              required
              min={t.start}
              value={t.end}
              onChange={(e) => update({ end: e.target.value })}
            />
          </div>
        </section>
        <section className="card form-section">
          <h2>A little atmosphere</h2>
          <Cover blob={t.cover} className="small-cover" />
          <Field
            label="Cover photo · Optional"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const problem =
                fileError(f) ||
                (!f.type.startsWith("image/") ? "Choose an image." : "");
              if (problem) err(problem);
              else {
                update({ cover: f });
                err("");
              }
            }}
          />
          {t.cover && (
            <button
              type="button"
              className="text-button"
              onClick={() => update({ cover: undefined })}
            >
              Remove cover
            </button>
          )}
        </section>
        <section className="card form-section">
          <h2>Your cities</h2>
          <p className="muted">
            Add each city once. You can return to it in your route.
          </p>
          {t.cities.map((c, i) => (
            <div className="inline-fields" key={c.id}>
              <Field
                label={`City ${i + 1}`}
                required
                value={c.name}
                onChange={(e) =>
                  update({
                    cities: t.cities.map((x) =>
                      x.id === c.id ? { ...x, name: e.target.value } : x,
                    ),
                  })
                }
              />
              <button
                type="button"
                className="icon danger"
                aria-label={`Remove city ${i + 1}`}
                onClick={() => {
                  if (
                    entries.some((e) => e.cityId === c.id) ||
                    t.stays.some((s) => s.cityId === c.id)
                  ) {
                    err(
                      "This city is in use. Move its records and remove its route stays first.",
                    );
                    return;
                  }
                  update({ cities: t.cities.filter((x) => x.id !== c.id) });
                }}
              >
                <X />
              </button>
            </div>
          ))}
          <button
            type="button"
            className="secondary"
            onClick={() =>
              update({ cities: [...t.cities, { id: uid(), name: "" }] })
            }
          >
            <Plus /> Add city
          </button>
        </section>
        <section className="card form-section">
          <h2>Your route</h2>
          <p className="muted">Dates may overlap on travel days.</p>
          {t.stays.map((s, i) => (
            <div className="stay-edit" key={s.id}>
              <div className="heading">
                <h3>Stay {i + 1}</h3>
                <button
                  type="button"
                  className="icon danger"
                  aria-label={`Remove stay ${i + 1}`}
                  onClick={() =>
                    update({ stays: t.stays.filter((x) => x.id !== s.id) })
                  }
                >
                  <Trash2 size={18} />
                </button>
              </div>
              <Select
                label="City"
                value={s.cityId}
                onChange={(v) =>
                  update({
                    stays: t.stays.map((x) =>
                      x.id === s.id ? { ...x, cityId: v } : x,
                    ),
                  })
                }
              >
                <option value="">Choose city</option>
                {t.cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
              <div className="two">
                <Field
                  label="From"
                  type="date"
                  required
                  min={t.start}
                  max={t.end}
                  value={s.start}
                  onChange={(e) =>
                    update({
                      stays: t.stays.map((x) =>
                        x.id === s.id ? { ...x, start: e.target.value } : x,
                      ),
                    })
                  }
                />
                <Field
                  label="Until"
                  type="date"
                  required
                  min={s.start || t.start}
                  max={t.end}
                  value={s.end}
                  onChange={(e) =>
                    update({
                      stays: t.stays.map((x) =>
                        x.id === s.id ? { ...x, end: e.target.value } : x,
                      ),
                    })
                  }
                />
              </div>
            </div>
          ))}
          <button
            type="button"
            className="secondary"
            disabled={!t.cities.length}
            onClick={() =>
              update({
                stays: [
                  ...t.stays,
                  {
                    id: uid(),
                    cityId: t.cities[0]?.id || "",
                    start: t.start,
                    end: t.end,
                  },
                ],
              })
            }
          >
            <Plus /> Add stay
          </button>
        </section>
        <Alert>{error}</Alert>
        <button className="primary wide" disabled={busy}>
          {busy ? "Saving…" : "Save trip"}
        </button>
      </form>
    </main>
  );
}

export function EntryForm({
  trip,
  initial,
  kind,
  files,
  initialDay,
}: {
  trip: Trip;
  initial?: Entry;
  kind: Kind;
  files: Attachment[];
  initialDay?: string;
}) {
  const [e, set] = useState<Entry>(() =>
    initial
      ? { ...initial }
      : {
          id: uid(),
          tripId: trip.id,
          kind,
          name: "",
          cityId:
            kind === "place" || kind === "hotel"
              ? trip.cities[0]?.id || ""
              : undefined,
          category: kind === "place" ? trip.categories[0]?.id : "Other",
          currency: "AED",
          status: "Planned",
          date: initialDay || "",
          order: Date.now(),
          transportType: "Train",
        },
  );
  const [added, add] = useState<Attachment[]>([]),
    [removed, remove] = useState<string[]>([]),
    [error, err] = useState(""),
    [busy, wait] = useState(false);
  const patch = (p: Partial<Entry>) => set((v) => ({ ...v, ...p }));
  const field = (
    label: string,
    key: keyof Entry,
    type = "text",
    required = false,
  ) => (
    <Field
      label={label}
      type={type}
      required={required}
      value={String(e[key] ?? "")}
      onChange={(x) => patch({ [key]: x.target.value })}
    />
  );
  const back = () =>
    go(
      trip.id +
        "/" +
        (kind === "place"
          ? "places"
          : kind === "hotel"
            ? "hotels"
            : kind === "transport"
              ? "transport"
              : "budget") +
        (initial ? "/" + initial.id : ""),
    );
  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    const normalized = {
      ...e,
      amount: e.amount?.replace(",", "."),
      currency: e.currency?.trim().toUpperCase(),
      date: e.date || undefined,
    };
    const problem = entryError(normalized, trip);
    if (problem) {
      err(problem);
      return;
    }
    wait(true);
    try {
      await saveEntry(normalized, added, removed);
      go(
        trip.id +
          "/" +
          (kind === "place"
            ? "places"
            : kind === "hotel"
              ? "hotels"
              : kind === "transport"
                ? "transport"
                : "budget") +
          "/" +
          e.id,
      );
    } catch (e) {
      err(storageError(e));
    } finally {
      wait(false);
    }
  };
  return (
    <main className="form-page">
      <Header title={`${initial ? "Edit" : "Add"} ${kind}`} back={back} />
      <form onSubmit={submit}>
        <Alert>{error}</Alert>
        <section className="card form-section">
          {field(
            kind === "transport" ? "Journey name" : "Name",
            "name",
            "text",
            true,
          )}
          {(kind === "place" || kind === "hotel") && (
            <Select
              label="City"
              value={e.cityId || ""}
              onChange={(v) => patch({ cityId: v })}
            >
              <option value="">Choose city</option>
              {trip.cities.map((c) => (
                <option value={c.id} key={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}
          {kind === "place" && (
            <Select
              label="Category"
              value={e.category || ""}
              onChange={(v) => patch({ category: v })}
            >
              {trip.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}
          {kind === "expense" && (
            <Select
              label="Category"
              value={e.category || "Other"}
              onChange={(v) => patch({ category: v })}
            >
              {budgetCategories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          )}
          {kind === "transport" && (
            <>
              <Select
                label="Transport type"
                value={e.transportType || "Other"}
                onChange={(v) => patch({ transportType: v })}
              >
                {["Flight", "Train", "Bus", "Ferry", "Taxi", "Other"].map(
                  (c) => (
                    <option key={c}>{c}</option>
                  ),
                )}
              </Select>
              {field("From", "origin", "text", true)}
              {field("To", "destination", "text", true)}
              <p className="hint">
                All times are local, as shown on your ticket.
              </p>
            </>
          )}
          <div className="two">
            {field(
              kind === "hotel"
                ? "Check-in"
                : kind === "transport"
                  ? "Departure date"
                  : "Date · Optional",
              "date",
              "date",
              kind === "hotel" || kind === "transport",
            )}
            {(kind === "hotel" || kind === "transport") &&
              field(
                kind === "hotel" ? "Check-out" : "Arrival date",
                "endDate",
                "date",
                true,
              )}
          </div>
          {(kind === "place" || kind === "transport") && (
            <div className="two">
              {field(
                kind === "transport"
                  ? "Departure time"
                  : "From time · Optional",
                "time",
                "time",
                kind === "transport",
              )}
              {field(
                kind === "transport" ? "Arrival time" : "Until time · Optional",
                "endTime",
                "time",
                kind === "transport",
              )}
            </div>
          )}
          {kind === "place" && (
            <label className="check">
              <input
                type="checkbox"
                checked={!!e.visited}
                onChange={(x) => patch({ visited: x.target.checked })}
              />{" "}
              Visited
            </label>
          )}
          {(kind === "place" || kind === "hotel") && (
            <>
              {field("Address · Optional", "address")}
              {field("Local name · Optional", "localName")}
              {field("Local address · Optional", "localAddress")}
            </>
          )}
          {kind !== "expense" &&
            field(
              kind === "place"
                ? "Map link · Optional"
                : "Website / booking link · Optional",
              "url",
              "url",
            )}
          {(kind === "hotel" || kind === "transport") &&
            field("Booking reference · Optional", "booking")}
          {kind === "transport" && (
            <>
              {field("Company · Optional", "company")}
              {field("Flight / train number · Optional", "number")}
            </>
          )}
          <Note value={e.notes || ""} onChange={(v) => patch({ notes: v })} />
        </section>
        <section className="card form-section">
          <h2>{kind === "place" ? "Estimated cost" : "Cost & payment"}</h2>
          {kind === "place" && (
            <p className="hint">
              For reference only. Add actual spending in Budget.
            </p>
          )}
          <div className="two">
            <Field
              label={kind === "expense" ? "Amount" : "Amount · Optional"}
              inputMode="decimal"
              value={e.amount || ""}
              required={kind === "expense"}
              onChange={(x) => patch({ amount: x.target.value })}
            />
            <Field
              label="Currency"
              maxLength={3}
              value={e.currency || "AED"}
              onChange={(x) =>
                patch({ currency: x.target.value.toUpperCase() })
              }
            />
          </div>
          {kind !== "place" && (
            <Select
              label="Payment status"
              value={e.status || "Planned"}
              onChange={(v) => patch({ status: v as Entry["status"] })}
            >
              <option>Planned</option>
              <option>Paid</option>
            </Select>
          )}
        </section>
        {(kind === "hotel" || kind === "transport") && (
          <section className="card form-section">
            <h2>Documents</h2>
            <p className="hint">
              PDF, JPEG, PNG or WebP · up to 20 MB each. Stored only on this
              device.
            </p>
            {[...files.filter((f) => !removed.includes(f.id)), ...added].map(
              (f) => (
                <div className="file-row" key={f.id}>
                  <span>{f.name}</span>
                  <button
                    type="button"
                    className="icon danger"
                    aria-label={"Remove " + f.name}
                    onClick={() => {
                      add(added.filter((a) => a.id !== f.id));
                      remove([...removed, f.id]);
                    }}
                  >
                    <X />
                  </button>
                </div>
              ),
            )}
            <Field
              label="Attach files · Optional"
              type="file"
              multiple
              accept="application/pdf,image/jpeg,image/png,image/webp"
              onChange={(x) => {
                const selected = Array.from(x.target.files || []);
                const errors = selected.map(fileError).filter(Boolean);
                err(errors.join(" "));
                add([
                  ...added,
                  ...selected
                    .filter((f) => !fileError(f))
                    .map((f) => ({
                      id: uid(),
                      tripId: trip.id,
                      entryId: e.id,
                      name: f.name,
                      type: f.type,
                      blob: f,
                    })),
                ]);
                x.target.value = "";
              }}
            />
          </section>
        )}
        <Alert>{error}</Alert>
        <button className="primary wide" disabled={busy}>
          {busy ? "Saving…" : `Save ${kind}`}
        </button>
      </form>
    </main>
  );
}
