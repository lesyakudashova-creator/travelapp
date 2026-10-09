import {
  useEffect,
  useRef,
  useState,
  useId,
  type ReactNode,
  type InputHTMLAttributes,
} from "react";
import {
  ArrowLeft,
  Plus,
  X,
  Copy,
  ExternalLink,
  MapPin,
  Compass,
} from "lucide-react";
export const go = (path = "") => {
  location.hash = "/" + path;
};
export function useRoute() {
  const [route, set] = useState(location.hash.slice(2));
  useEffect(() => {
    const f = () => {
      set(location.hash.slice(2));
      window.scrollTo(0, 0);
    };
    addEventListener("hashchange", f);
    return () => removeEventListener("hashchange", f);
  }, []);
  return route.split("/");
}
export function useBlob(blob?: Blob) {
  const [url, set] = useState("");
  useEffect(() => {
    if (!blob) {
      set("");
      return;
    }
    const u = URL.createObjectURL(blob);
    set(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}
export function Cover({
  blob,
  children,
  className = "",
}: {
  blob?: Blob;
  children?: ReactNode;
  className?: string;
}) {
  const url = useBlob(blob);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [blob]);
  return (
    <div className={"cover " + className}>
      {url && !failed ? (
        <img src={url} alt="Trip cover" onError={() => setFailed(true)} />
      ) : (
        <div className="cover-placeholder" aria-hidden="true">
          <Compass size={64} strokeWidth={1} />
          <span>Somewhere wonderful</span>
        </div>
      )}
      {children}
    </div>
  );
}
export function Header({
  title,
  sub,
  back,
  action,
}: {
  title: string;
  sub?: string;
  back?: () => void;
  action?: ReactNode;
}) {
  return (
    <header>
      {back && (
        <button className="back" onClick={back}>
          <ArrowLeft /> Back
        </button>
      )}
      <div className="heading">
        <div>
          <h1>{title}</h1>
          {sub && <p>{sub}</p>}
        </div>
        {action}
      </div>
    </header>
  );
}
export function Add({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button className="primary" onClick={onClick}>
      <Plus size={20} />
      {children}
    </button>
  );
}
export function Empty({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="empty">
      <MapPin size={30} />
      <h2>{title}</h2>
      <p>{children}</p>
      {action}
    </section>
  );
}
export function Field({
  label,
  error,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input {...props} />
      {error && <small className="error">{error}</small>}
    </label>
  );
}
export function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <label className="field" htmlFor={id}>
      <span id={id + "-label"}>{label}</span>
      <select
        id={id}
        aria-labelledby={id + "-label"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {children}
      </select>
    </label>
  );
}
export function Note({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="field">
      <span>Notes · Optional</span>
      <textarea
        rows={4}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
export function Alert({ children }: { children: ReactNode }) {
  return children ? (
    <div className="alert" role="alert">
      {children}
    </div>
  ) : null;
}
export function Dialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="heading">
        <h2>{title}</h2>
        <button className="icon" aria-label="Close" onClick={onClose}>
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function CopyText({ label, text }: { label: string; text?: string }) {
  const [message, set] = useState("");
  if (!text) return null;
  return (
    <div className="copy-row">
      <div>
        <small>{label}</small>
        <p>{text}</p>
        {message && <small role="status">{message}</small>}
      </div>
      <button
        className="icon"
        aria-label={"Copy " + label.toLowerCase()}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            set("Copied");
          } catch {
            set("Select the text and choose Copy.");
          }
        }}
      >
        <Copy size={19} />
      </button>
    </div>
  );
}
export function External({
  url,
  children,
}: {
  url?: string;
  children: ReactNode;
}) {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  return (
    <a
      className="button secondary"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
      <ExternalLink size={17} />
    </a>
  );
}
