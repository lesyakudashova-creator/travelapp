import { useEffect, useState, Component, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useRegisterSW } from "virtual:pwa-register/react";
import {
  Map,
  MapPin,
  BedDouble,
  TrainFront,
  ChartPie,
  ChevronRight,
  ChevronLeft,
  Plus,
  Pencil,
  ArrowUp,
  ArrowDown,
  Check,
  FileText,
  Trash2,
  Settings2,
  WifiOff,
  Compass,
} from "lucide-react";
import { db, deleteTrip, deleteEntry, saveTrip, storageError } from "./db";
import {
  type Trip,
  type Entry,
  type Attachment,
  type Kind,
  budget,
  prettyDate,
  today,
  shiftDay,
  money,
  positive,
  uid,
  reordered,
} from "./model";
import {
  Header,
  Add,
  Empty,
  Cover,
  Field,
  Dialog,
  Alert,
  Select,
  CopyText,
  External,
  useRoute,
  useBlob,
  go,
} from "./ui";
import { TripForm, EntryForm } from "./forms";

const sections = [
  { id: "overview", name: "Overview", icon: Map },
  { id: "places", name: "Places", icon: MapPin },
  { id: "hotels", name: "Hotels", icon: BedDouble },
  { id: "transport", name: "Transport", icon: TrainFront },
  { id: "budget", name: "Budget", icon: ChartPie },
];
const kinds: Record<string, Kind> = {
  places: "place",
  hotels: "hotel",
  transport: "transport",
  budget: "expense",
};
const sectionFor = (e: Entry) =>
  e.kind === "place"
    ? "places"
    : e.kind === "hotel"
      ? "hotels"
      : e.kind === "transport"
        ? "transport"
        : "budget";

class Boundary extends Component<{ children: ReactNode }, { error: string }> {
  state = { error: "" };
  static getDerivedStateFromError(e: Error) {
    return { error: e.message };
  }
  render() {
    return this.state.error ? (
      <main>
        <Header title="Could not open your planner" />
        <Alert>{this.state.error}</Alert>
        <p>Your saved data has not been cleared.</p>
        <button className="primary" onClick={() => location.reload()}>
          Try again
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
export default function App() {
  return (
    <Boundary>
      <Planner />
    </Boundary>
  );
}
function Planner() {
  const route = useRoute();
  const trips = useLiveQuery(() => db.trips.toArray());
  const trip = trips?.find((t) => t.id === route[0]);
  const entries = useLiveQuery<Entry[]>(
    () =>
      route[0]
        ? db.entries.where("tripId").equals(route[0]).toArray()
        : Promise.resolve([]),
    [route[0]],
  );
  const attachments = useLiveQuery<Attachment[]>(
    () =>
      route[2]
        ? db.attachments.where("entryId").equals(route[2]).toArray()
        : Promise.resolve([]),
    [route[2]],
  );
  const [error, err] = useState("");
  const [offline, setOffline] = useState(!navigator.onLine);
  const [prepared, setPrepared] = useState(false);
  const {
    offlineReady: [ready],
    needRefresh: [refresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError: (e) =>
      err("Offline setup failed. Reconnect and reopen the app. " + e.message),
  });
  useEffect(() => {
    let active = true;
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.ready.then(() => {
        if (active) setPrepared(true);
      });
    }
    const on = () => setOffline(!navigator.onLine);
    addEventListener("online", on);
    addEventListener("offline", on);
    return () => {
      active = false;
      removeEventListener("online", on);
      removeEventListener("offline", on);
    };
  }, []);
  if (!trips || !entries)
    return (
      <main>
        <div className="loading" role="status">
          Opening your planner…
        </div>
      </main>
    );
  const section = route[1] || "overview";
  const isForm =
    route[0] === "new" ||
    section === "edit" ||
    route[2] === "new" ||
    route[3] === "edit";
  const entry = entries.find((e) => e.id === route[2]);
  return (
    <>
      <div className="app-shell">
        {offline && (
          <div className="network">
            <WifiOff size={14} /> Offline · your saved plans are available
          </div>
        )}
        {error && <Alert>{error}</Alert>}
        {route[0] === "new" ? (
          <TripForm entries={[]} />
        ) : !route[0] ? (
          <Trips trips={trips} ready={ready || prepared} />
        ) : !trip ? (
          <main>
            <Header title="Trip not found" back={() => go()} />
            <p>This trip may have been deleted.</p>
          </main>
        ) : section === "edit" ? (
          <TripForm key={trip.id} initial={trip} entries={entries} />
        ) : route[2] === "new" && kinds[section] ? (
          <EntryForm
            key={route.join("/")}
            trip={trip}
            kind={kinds[section]}
            files={[]}
            initialDay={route[3]}
          />
        ) : entry && route[3] === "edit" ? (
          <EntryForm
            key={entry.id}
            trip={trip}
            initial={entry}
            kind={entry.kind}
            files={attachments || []}
          />
        ) : entry ? (
          <Details trip={trip} entry={entry} files={attachments || []} />
        ) : route[2] ? (
          <main>
            <Header
              title="Record not found"
              back={() => go(trip.id + "/" + section)}
            />
          </main>
        ) : (
          <TripScreen
            key={trip.id + "/" + section}
            trip={trip}
            section={section}
            entries={entries}
          />
        )}
        {trip && !isForm && (
          <nav className="bottom-nav" aria-label="Trip sections">
            {sections.map((s) => (
              <button
                key={s.id}
                aria-current={s.id === section ? "page" : undefined}
                className={s.id === section ? "active" : ""}
                onClick={() => go(trip.id + "/" + s.id)}
              >
                <s.icon size={22} />
                <span>{s.name}</span>
              </button>
            ))}
          </nav>
        )}
        {refresh && !isForm && (
          <div className="update">
            <span>A new version is ready.</span>
            <button onClick={() => updateServiceWorker(true)}>Update</button>
          </div>
        )}
      </div>
    </>
  );
}
function Trips({ trips, ready }: { trips: Trip[]; ready: boolean }) {
  const sorted = [...trips].sort((a, b) => a.start.localeCompare(b.start));
  return (
    <main className="trips-page">
      <div className="brand">
        <Compass size={18} /> TRAVEL PLANNER
      </div>
      <Header
        title="My trips"
        sub="Your next adventure, all in one place."
        action={
          <button
            className="icon elevated"
            aria-label="New trip"
            onClick={() => go("new")}
          >
            <Plus />
          </button>
        }
      />
      {!trips.length ? (
        <Empty
          title="Your journey starts here"
          action={<Add onClick={() => go("new")}>New trip</Add>}
        >
          A weekend away or a world of possibilities. Keep your plans, stays and
          tickets together.
        </Empty>
      ) : (
        <>
          {[
            {
              label: "Your journeys",
              items: sorted.filter((t) => t.end >= today()),
            },
            {
              label: "Past journeys",
              items: sorted.filter((t) => t.end < today()).reverse(),
            },
          ].map(
            (g) =>
              g.items.length > 0 && (
                <section key={g.label}>
                  <h2 className="eyebrow">{g.label}</h2>
                  {g.items.map((t) => (
                    <button
                      className="trip-card"
                      key={t.id}
                      onClick={() => go(t.id + "/overview")}
                    >
                      <Cover blob={t.cover}>
                        <div className="trip-caption">
                          <div>
                            <h2>{t.name}</h2>
                            <p>
                              {prettyDate(t.start)} – {prettyDate(t.end)} ·{" "}
                              {t.start.slice(0, 4)}
                            </p>
                          </div>
                          <span className="round-arrow">
                            <ChevronRight />
                          </span>
                        </div>
                      </Cover>
                    </button>
                  ))}
                </section>
              ),
          )}
          <Add onClick={() => go("new")}>New trip</Add>
        </>
      )}
      <footer>
        <p>Your plans, stays and tickets — together.</p>
        <div className="local-note">
          <h3>A little note about your data</h3>
          <p>
            Saved only in this browser on this device. Clearing website data can
            erase your trips and documents. Local storage is not a backup.
          </p>
          <p>
            {ready
              ? "Ready for offline use."
              : "Open online once to prepare offline use."}{" "}
            External maps and websites may need a connection.
          </p>
        </div>
        <p className="hint">
          On iPhone: open in Safari → Share → Add to Home Screen.
        </p>
      </footer>
    </main>
  );
}

function TripScreen({
  trip,
  section,
  entries,
}: {
  trip: Trip;
  section: string;
  entries: Entry[];
}) {
  const [error, err] = useState(""),
    [confirm, setConfirm] = useState(false);
  const [city, setCity] = useState(""),
    [category, setCategory] = useState(""),
    [categories, showCategories] = useState(false);
  const open = (e: Entry) => go(trip.id + "/" + sectionFor(e) + "/" + e.id);
  const remove = async () => {
    try {
      await deleteTrip(trip.id);
      go();
    } catch (e) {
      err(storageError(e));
      setConfirm(false);
    }
  };
  const title = sections.find((s) => s.id === section)?.name || "Overview";
  return (
    <main>
      {section === "overview" ? (
        <>
          <div className="overview-hero">
            <Cover blob={trip.cover}>
              <div className="hero-actions">
                <button
                  className="icon elevated"
                  aria-label="Back to trips"
                  onClick={() => go()}
                >
                  <ChevronLeft />
                </button>
                <button
                  className="icon elevated"
                  aria-label="Edit trip"
                  onClick={() => go(trip.id + "/edit")}
                >
                  <Pencil size={20} />
                </button>
              </div>
            </Cover>
            <div className="glass overview-title">
              <span className="eyebrow">YOUR JOURNEY</span>
              <h1>{trip.name}</h1>
              <p>
                {prettyDate(trip.start)} – {prettyDate(trip.end)} ·{" "}
                {trip.start.slice(0, 4)}
              </p>
              <p className="muted">{trip.countries}</p>
            </div>
          </div>
          <section className="route-section">
            <div className="heading">
              <h2>The route</h2>
              <button
                className="text-button"
                onClick={() => go(trip.id + "/edit")}
              >
                Edit
              </button>
            </div>
            {trip.stays.length ? (
              <ol className="route-list">
                {[...trip.stays]
                  .sort((a, b) => a.start.localeCompare(b.start))
                  .map((s) => (
                    <li key={s.id}>
                      <strong>
                        {trip.cities.find((c) => c.id === s.cityId)?.name}
                      </strong>
                      <span>
                        {prettyDate(s.start)} – {prettyDate(s.end)}
                      </span>
                    </li>
                  ))}
              </ol>
            ) : (
              <p className="muted">
                Add cities and stays in Edit trip to shape your route.
              </p>
            )}
          </section>
          <DayPlan trip={trip} entries={entries} open={open} />
          <button
            className="text-button danger delete-trip"
            onClick={() => setConfirm(true)}
          >
            <Trash2 size={16} /> Delete trip
          </button>
        </>
      ) : (
        <>
          <Header
            title={title}
            sub={
              section === "places"
                ? "A few favourites for your journey."
                : section === "hotels"
                  ? "Your stays, neatly organised."
                  : section === "transport"
                    ? "Every step of the journey."
                    : "A clear view of your travel spending."
            }
            back={() => go()}
          />
          {section === "budget" ? (
            <Budget trip={trip} entries={entries} open={open} />
          ) : (
            <>
              {section === "places" && (
                <div className="filters">
                  <Select label="City" value={city} onChange={setCity}>
                    <option value="">All cities</option>
                    {trip.cities.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                  <div className="chips">
                    <button
                      className={!category ? "selected" : ""}
                      aria-pressed={!category}
                      onClick={() => setCategory("")}
                    >
                      All
                    </button>
                    {trip.categories.map((c) => (
                      <button
                        key={c.id}
                        className={category === c.id ? "selected" : ""}
                        aria-pressed={category === c.id}
                        onClick={() => setCategory(c.id)}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                  <button
                    className="text-button"
                    onClick={() => showCategories(true)}
                  >
                    <Settings2 size={16} /> Manage categories
                  </button>
                </div>
              )}
              <div className="entry-list">
                {entries
                  .filter(
                    (e) =>
                      e.kind === kinds[section] &&
                      (!city || e.cityId === city) &&
                      (!category || e.category === category),
                  )
                  .sort((a, b) =>
                    (a.date || "9999").localeCompare(b.date || "9999"),
                  )
                  .map((e) => (
                    <EntryCard
                      key={e.id}
                      entry={e}
                      trip={trip}
                      onClick={() => open(e)}
                    />
                  ))}
              </div>
              {!entries.some(
                (e) =>
                  e.kind === kinds[section] &&
                  (!city || e.cityId === city) &&
                  (!category || e.category === category),
              ) && (
                <Empty
                  title={
                    city || category
                      ? "No matches yet"
                      : `No ${section === "transport" ? "journeys" : section} yet`
                  }
                >
                  {section === "places"
                    ? "Save an idea now. Decide on a day later."
                    : section === "hotels"
                      ? "Keep addresses, confirmations and costs in one place."
                      : "Keep your tickets and local departure times close at hand."}
                </Empty>
              )}
              <Add onClick={() => go(trip.id + "/" + section + "/new")}>
                Add {kinds[section]}
              </Add>
            </>
          )}
        </>
      )}
      <Alert>{error}</Alert>
      {confirm && (
        <Dialog title="Delete this trip?" onClose={() => setConfirm(false)}>
          <p>
            “{trip.name}” and all its places, bookings, expenses and documents
            will be permanently deleted from this device.
          </p>
          <div className="dialog-actions">
            <button className="secondary" onClick={() => setConfirm(false)}>
              Keep trip
            </button>
            <button className="destructive" onClick={remove}>
              Delete trip
            </button>
          </div>
        </Dialog>
      )}
      {categories && (
        <CategoryManager trip={trip} close={() => showCategories(false)} />
      )}
    </main>
  );
}
function EntryCard({
  entry: e,
  trip,
  onClick,
}: {
  entry: Entry;
  trip: Trip;
  onClick: () => void;
}) {
  return (
    <button className="entry-card" onClick={onClick}>
      <div className="entry-symbol">
        {e.kind === "place" ? (
          <MapPin />
        ) : e.kind === "hotel" ? (
          <BedDouble />
        ) : e.kind === "transport" ? (
          <TrainFront />
        ) : (
          <ChartPie />
        )}
      </div>
      <div className="entry-copy">
        <h3>{e.name}</h3>
        <p>
          {e.kind === "transport"
            ? `${e.origin} → ${e.destination}`
            : trip.cities.find((c) => c.id === e.cityId)?.name || e.category}
        </p>
        {e.kind === "place" && (
          <p>{trip.categories.find((c) => c.id === e.category)?.name}</p>
        )}
        <p>
          {prettyDate(e.date)}
          {e.endDate ? " – " + prettyDate(e.endDate) : ""}
          {e.time ? " · " + e.time : ""}
        </p>
        {e.amount && (
          <strong className="amount">
            {e.currency} {money(e.amount)}
          </strong>
        )}
        {e.visited && <span className="badge paid">Visited</span>}
        {e.kind !== "place" && e.amount && (
          <span className={"badge " + (e.status === "Paid" ? "paid" : "")}>
            {e.status || "Planned"}
          </span>
        )}
      </div>
      <ChevronRight size={20} />
    </button>
  );
}
function DayPlan({
  trip,
  entries,
  open,
}: {
  trip: Trip;
  entries: Entry[];
  open: (e: Entry) => void;
}) {
  const [day, setDay] = useState(
      today() >= trip.start && today() <= trip.end ? today() : trip.start,
    ),
    [chooser, choose] = useState(false),
    [error, err] = useState("");
  const places = entries
    .filter((e) => e.kind === "place" && e.date === day)
    .sort(
      (a, b) => (a.order || 0) - (b.order || 0) || a.id.localeCompare(b.id),
    );
  const events = entries.filter(
    (e) =>
      (e.kind === "hotel" || e.kind === "transport") &&
      (e.date === day || e.endDate === day),
  );
  async function move(e: Entry, d: number) {
    try {
      await db.entries.bulkPut(reordered(places, e.id, d));
    } catch (e) {
      err(storageError(e));
    }
  }
  return (
    <section>
      <div className="heading">
        <h2>Day plan</h2>
        <button className="text-button" onClick={() => choose(true)}>
          <Plus size={18} /> Add place
        </button>
      </div>
      <div className="day-selector">
        <button
          className="icon"
          aria-label="Previous day"
          disabled={day <= trip.start}
          onClick={() => setDay(shiftDay(day, -1))}
        >
          <ChevronLeft />
        </button>
        <label>
          <span className="sr-only">Plan date</span>
          <input
            aria-label="Plan date"
            type="date"
            min={trip.start}
            max={trip.end}
            value={day}
            onChange={(e) => {
              if (e.target.value >= trip.start && e.target.value <= trip.end)
                setDay(e.target.value);
            }}
          />
          <small>
            {trip.stays
              .filter((s) => s.start <= day && s.end >= day)
              .map((s) => trip.cities.find((c) => c.id === s.cityId)?.name)
              .filter((x, i, a) => a.indexOf(x) === i)
              .join(" · ") || "A day to explore"}
          </small>
        </label>
        <button
          className="icon"
          aria-label="Next day"
          disabled={day >= trip.end}
          onClick={() => setDay(shiftDay(day, 1))}
        >
          <ChevronRight />
        </button>
      </div>
      {events.length > 0 && (
        <div className="day-bookings">
          {events.map((e) => (
            <button key={e.id} onClick={() => open(e)}>
              <span className="event-icon">
                {e.kind === "hotel" ? (
                  <BedDouble size={18} />
                ) : (
                  <TrainFront size={18} />
                )}
              </span>
              <span>
                <strong>{e.name}</strong>
                <small>
                  {e.kind === "hotel"
                    ? e.date === day
                      ? "Check-in"
                      : "Check-out"
                    : [
                        e.date === day ? `Departs ${e.time} (local)` : null,
                        e.endDate === day
                          ? `Arrives ${e.endTime} (local)`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                </small>
              </span>
              <ChevronRight size={18} />
            </button>
          ))}
        </div>
      )}
      {!places.length && !events.length && (
        <Empty title="A little room to wander">
          Nothing planned for this day. Add a place from your collection.
        </Empty>
      )}
      {places.map((e, i) => (
        <div className="plan-row" key={e.id}>
          <button className="plan-main" onClick={() => open(e)}>
            <span className="plan-time">
              {e.time || "Any time"}
              {e.endTime && <small>– {e.endTime}</small>}
            </span>
            <span>
              <strong>{e.name}</strong>
              <small>
                {trip.categories.find((c) => c.id === e.category)?.name}
              </small>
            </span>
          </button>
          <div className="plan-controls">
            <button
              className="icon"
              aria-label={"Move " + e.name + " up"}
              disabled={i === 0}
              onClick={() => move(e, -1)}
            >
              <ArrowUp size={16} />
            </button>
            <button
              className="icon"
              aria-label={"Move " + e.name + " down"}
              disabled={i === places.length - 1}
              onClick={() => move(e, 1)}
            >
              <ArrowDown size={16} />
            </button>
          </div>
        </div>
      ))}
      <Alert>{error}</Alert>
      {chooser && (
        <Dialog title="Add to this day" onClose={() => choose(false)}>
          <p>{prettyDate(day)} · choose a saved place or add a new one.</p>
          <div className="choose-list">
            {entries
              .filter((e) => e.kind === "place" && e.date !== day)
              .map((e) => (
                <button
                  className="secondary"
                  key={e.id}
                  onClick={async () => {
                    try {
                      await db.entries.update(e.id, {
                        date: day,
                        order: Date.now(),
                      });
                      choose(false);
                    } catch (e) {
                      err(storageError(e));
                      choose(false);
                    }
                  }}
                >
                  {e.name}
                  {e.date && <small>Move from {prettyDate(e.date)}</small>}
                </button>
              ))}
          </div>
          <Add onClick={() => go(trip.id + "/places/new/" + day)}>
            New place
          </Add>
        </Dialog>
      )}
    </section>
  );
}
function CategoryManager({ trip, close }: { trip: Trip; close: () => void }) {
  const [list, set] = useState(trip.categories.map((c) => ({ ...c }))),
    [error, err] = useState("");
  return (
    <Dialog title="Place categories" onClose={close}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (list.some((c) => !c.name.trim())) {
            err("Give each category a name.");
            return;
          }
          try {
            await saveTrip({ ...trip, categories: list });
            close();
          } catch (e) {
            err(storageError(e));
          }
        }}
      >
        {list.map((c, i) => (
          <Field
            key={c.id}
            label={`Category ${i + 1}`}
            required
            value={c.name}
            onChange={(e) =>
              set(
                list.map((x) =>
                  x.id === c.id ? { ...x, name: e.target.value } : x,
                ),
              )
            }
          />
        ))}
        <button
          type="button"
          className="text-button"
          onClick={() => set([...list, { id: uid(), name: "" }])}
        >
          <Plus size={18} /> Add category
        </button>
        <Alert>{error}</Alert>
        <button className="primary wide">Save categories</button>
      </form>
    </Dialog>
  );
}
function Budget({
  trip,
  entries,
  open,
}: {
  trip: Trip;
  entries: Entry[];
  open: (e: Entry) => void;
}) {
  const [filter, setFilter] = useState("All"),
    [rates, showRates] = useState(false);
  const b = budget(entries, trip.rates);
  return (
    <>
      <section className="budget-hero">
        <span className="eyebrow">
          {b.missing.length ? "KNOWN TOTAL · AED" : "TOTAL · AED"}
        </span>
        <div className="total">{b.total}</div>
        <p className="hint">Approximate conversion using your rates</p>
        <div className="budget-split">
          <div>
            <span className="status-dot" /> Paid<strong>AED {b.paid}</strong>
          </div>
          <div>
            Planned<strong>AED {b.planned}</strong>
          </div>
        </div>
      </section>
      {b.missing.length > 0 && (
        <div className="warning">
          Total is incomplete. Add a rate for {b.missing.join(", ")}.
          <button className="text-button" onClick={() => showRates(true)}>
            Set exchange rates
          </button>
        </div>
      )}
      <button className="text-button" onClick={() => showRates(true)}>
        <Settings2 size={17} /> Exchange rates
      </button>
      <section className="card category-totals">
        <h2>By category</h2>
        {b.categories.map((c) => (
          <div key={c.name}>
            <span>{c.name}</span>
            <strong>AED {c.amount}</strong>
          </div>
        ))}
      </section>
      <div className="heading">
        <h2>Expenses</h2>
        <button
          className="text-button"
          onClick={() => go(trip.id + "/budget/new")}
        >
          <Plus size={18} /> Add
        </button>
      </div>
      <div className="chips">
        {["All", "Paid", "Planned"].map((s) => (
          <button
            key={s}
            className={filter === s ? "selected" : ""}
            aria-pressed={filter === s}
            onClick={() => setFilter(s)}
          >
            {s}
          </button>
        ))}
      </div>
      <div className="entry-list">
        {b.rows
          .filter((e) => filter === "All" || (e.status || "Planned") === filter)
          .map((e) => (
            <button
              className="expense-row card"
              key={e.id}
              onClick={() => open(e)}
            >
              <div>
                <h3>{e.name}</h3>
                <p>
                  {e.category}
                  {e.kind !== "expense" ? " · Linked booking" : ""}
                </p>
                <span
                  className={"badge " + (e.status === "Paid" ? "paid" : "")}
                >
                  {e.status || "Planned"}
                </span>
              </div>
              <div className="expense-value">
                <strong>
                  {e.currency} {money(e.amount!)}
                </strong>
                <small>
                  {e.aed === null ? "Rate needed" : "≈ AED " + e.aed}
                </small>
                <ChevronRight size={18} />
              </div>
            </button>
          ))}
      </div>
      {!b.rows.length && (
        <Empty title="A fresh start">
          Add an expense, or enter a cost on a hotel or transport booking.
        </Empty>
      )}
      <Add onClick={() => go(trip.id + "/budget/new")}>Add expense</Add>
      {rates && (
        <Rates
          trip={trip}
          currencies={[...new Set(b.rows.map((e) => e.currency || "AED"))]}
          close={() => showRates(false)}
        />
      )}
    </>
  );
}
function Rates({
  trip,
  currencies,
  close,
}: {
  trip: Trip;
  currencies: string[];
  close: () => void;
}) {
  const [values, set] = useState({ ...trip.rates }),
    [code, setCode] = useState(""),
    [error, err] = useState("");
  const all = [...new Set([...currencies, ...Object.keys(values)])].filter(
    (c) => c !== "AED",
  );
  return (
    <Dialog title="Exchange rates" onClose={close}>
      <p>
        Enter how many AED one unit buys. Updating a rate also recalculates paid
        expenses.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (
            Object.entries(values).some(
              ([c, v]) => c !== "AED" && v && !positive(v.replace(",", ".")),
            )
          ) {
            err("Every entered rate must be greater than zero.");
            return;
          }
          try {
            await saveTrip({
              ...trip,
              rates: Object.fromEntries(
                Object.entries(values)
                  .filter(([, v]) => v)
                  .map(([k, v]) => [k, v.replace(",", ".")]),
              ),
            });
            close();
          } catch (e) {
            err(storageError(e));
          }
        }}
      >
        {all.map((c) => (
          <Field
            key={c}
            label={`1 ${c} = … AED`}
            inputMode="decimal"
            value={values[c] || ""}
            onChange={(e) => set({ ...values, [c]: e.target.value })}
          />
        ))}
        <p className="hint">1 AED = 1 AED. Blank rates remain unset.</p>
        <div className="inline-fields">
          <Field
            label="Add currency"
            placeholder="CNY"
            maxLength={3}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
          <button
            type="button"
            className="icon"
            aria-label="Add currency"
            onClick={() => {
              if (/^[A-Z]{3}$/.test(code)) {
                set({ ...values, [code]: values[code] || "" });
                setCode("");
              } else err("Use a three-letter currency code.");
            }}
          >
            <Plus />
          </button>
        </div>
        <Alert>{error}</Alert>
        <button className="primary wide">Save rates</button>
      </form>
    </Dialog>
  );
}

function Document({ file }: { file: Attachment }) {
  const url = useBlob(file.blob);
  const [preview, show] = useState(false);
  return (
    <>
      <div className="document-row">
        <FileText size={20} />
        <div>
          <strong>{file.name}</strong>
          <small>
            {file.type === "application/pdf" ? "PDF" : "Image"} ·{" "}
            {(file.blob.size / 1024 / 1024).toFixed(1)} MB
          </small>
        </div>
        {file.type === "application/pdf" ? (
          <a
            className="button secondary"
            href={url}
            target="_blank"
            rel="noopener"
          >
            Open
          </a>
        ) : (
          <button className="secondary" onClick={() => show(true)}>
            Open
          </button>
        )}
      </div>
      {preview && (
        <Dialog title={file.name} onClose={() => show(false)}>
          <img className="document-image" src={url} alt={file.name} />
        </Dialog>
      )}
    </>
  );
}
function Details({
  trip,
  entry: e,
  files,
}: {
  trip: Trip;
  entry: Entry;
  files: Attachment[];
}) {
  const [confirm, setConfirm] = useState(false),
    [error, err] = useState("");
  const section = sectionFor(e);
  async function patch(value: Partial<Entry>) {
    try {
      await db.entries.update(e.id, value);
    } catch (e) {
      err(storageError(e));
    }
  }
  return (
    <main>
      <Header
        title={e.name}
        sub={
          e.kind === "transport"
            ? e.transportType
            : trip.cities.find((c) => c.id === e.cityId)?.name
        }
        back={() => go(trip.id + "/" + section)}
        action={
          <button
            className="icon elevated"
            aria-label={"Edit " + e.kind}
            onClick={() => go(trip.id + "/" + section + "/" + e.id + "/edit")}
          >
            <Pencil size={19} />
          </button>
        }
      />
      <section className="card detail-card">
        {e.kind === "transport" ? (
          <>
            <div className="journey-point">
              <span>FROM</span>
              <h2>{e.origin}</h2>
              <p>
                {prettyDate(e.date)} · {e.time} <small>local time</small>
              </p>
            </div>
            <div className="journey-point">
              <span>TO</span>
              <h2>{e.destination}</h2>
              <p>
                {prettyDate(e.endDate)} · {e.endTime} <small>local time</small>
              </p>
            </div>
            {e.company && <p>{e.company}</p>}
            {e.number && (
              <CopyText label="Flight / train number" text={e.number} />
            )}
          </>
        ) : (
          <div className="detail-dates">
            <div>
              <small>{e.kind === "hotel" ? "Check-in" : "Date"}</small>
              <strong>{prettyDate(e.date)}</strong>
            </div>
            {e.endDate && (
              <div>
                <small>Check-out</small>
                <strong>{prettyDate(e.endDate)}</strong>
              </div>
            )}
            {e.time && (
              <p>
                {e.time}
                {e.endTime ? " – " + e.endTime : ""}
              </p>
            )}
          </div>
        )}
        {e.kind === "place" && (
          <>
            <p>{trip.categories.find((c) => c.id === e.category)?.name}</p>
            <button
              className={"secondary " + (e.visited ? "visited" : "")}
              onClick={() => patch({ visited: !e.visited })}
            >
              <Check size={18} />
              {e.visited ? "Visited" : "Mark visited"}
            </button>
            {e.date && (
              <button
                className="text-button"
                onClick={() =>
                  patch({
                    date: undefined,
                    time: undefined,
                    endTime: undefined,
                  })
                }
              >
                Remove from day plan
              </button>
            )}
          </>
        )}
        <CopyText label="Local name" text={e.localName} />
        <CopyText label="Address" text={e.address} />
        <CopyText label="Local address" text={e.localAddress} />
        <CopyText label="Booking reference" text={e.booking} />
        <External url={e.url}>
          {e.kind === "place" ? "Open map" : "Open website"}
        </External>
        {!e.url && (e.localAddress || e.address) && (
          <External
            url={
              "https://www.google.com/maps/search/?api=1&query=" +
              encodeURIComponent(e.localAddress || e.address || "")
            }
          >
            Open map
          </External>
        )}
        {e.notes && (
          <div className="notes">
            <h3>Notes</h3>
            <p>{e.notes}</p>
          </div>
        )}
      </section>
      {e.amount && (
        <section className="card detail-card">
          <h2>{e.kind === "place" ? "Estimated cost" : "Payment"}</h2>
          <div className="detail-amount">
            {e.currency} {money(e.amount)}
          </div>
          {e.kind === "place" ? (
            <p className="hint">Not included in your budget.</p>
          ) : (
            <>
              <span className={"badge " + (e.status === "Paid" ? "paid" : "")}>
                {e.status || "Planned"}
              </span>
              <button
                className="secondary"
                onClick={() =>
                  patch({ status: e.status === "Paid" ? "Planned" : "Paid" })
                }
              >
                Mark as {e.status === "Paid" ? "planned" : "paid"}
              </button>
              <p className="hint">
                {e.kind !== "expense"
                  ? "Automatically included in Budget."
                  : "Included in Budget."}
              </p>
            </>
          )}
        </section>
      )}
      {(e.kind === "hotel" || e.kind === "transport") && (
        <section className="card detail-card">
          <div className="heading">
            <h2>Documents</h2>
            <button
              className="text-button"
              onClick={() => go(trip.id + "/" + section + "/" + e.id + "/edit")}
            >
              Add
            </button>
          </div>
          {files.length ? (
            files.map((f) => <Document key={f.id} file={f} />)
          ) : (
            <p className="muted">No documents attached yet.</p>
          )}
        </section>
      )}
      <Alert>{error}</Alert>
      <button className="text-button danger" onClick={() => setConfirm(true)}>
        <Trash2 size={17} /> Delete {e.kind}
      </button>
      {confirm && (
        <Dialog title={`Delete ${e.kind}?`} onClose={() => setConfirm(false)}>
          <p>
            “{e.name}” will be deleted
            {e.kind === "hotel" || e.kind === "transport"
              ? ", together with its documents and linked budget expense"
              : ""}
            .
          </p>
          <div className="dialog-actions">
            <button className="secondary" onClick={() => setConfirm(false)}>
              Keep it
            </button>
            <button
              className="destructive"
              onClick={async () => {
                try {
                  await deleteEntry(e.id);
                  go(trip.id + "/" + section);
                } catch (e) {
                  err(storageError(e));
                  setConfirm(false);
                }
              }}
            >
              Delete
            </button>
          </div>
        </Dialog>
      )}
    </main>
  );
}
