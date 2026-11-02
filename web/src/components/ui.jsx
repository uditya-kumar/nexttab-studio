import { useEffect, useState } from "react";
import { CircleAlert, LoaderCircle, RefreshCw, X } from "lucide-react";
import { change, initials, num } from "../lib/format.js";

export const ICON = { size: 16, strokeWidth: 1.5 };

export function PageHead({ title, sub, children }) {
  return (
    <header className="page-head">
      <div>
        <h1>{title}</h1>
        {sub && <p className="sub">{sub}</p>}
      </div>
      {children && <div className="tools">{children}</div>}
    </header>
  );
}

export function Key({ children, lit, sm, onRemove }) {
  return (
    <span className={`key ${lit ? "lit" : ""} ${sm ? "sm" : ""}`}>
      {children}
      {onRemove && (
        <button type="button" className="x" onClick={onRemove} aria-label={`Remove ${children}`}>
          <X size={12} strokeWidth={1.5} />
        </button>
      )}
    </span>
  );
}

export function Segmented({ value, onChange, options, label }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({ checked, onChange, disabled, label }) {
  return (
    <button
      type="button"
      role="switch"
      className="switch"
      aria-checked={!!checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    />
  );
}

// days: length of the comparison window. When the previous period is empty or tiny,
// a percentage is meaningless, so the card states the previous figure instead.
export function Stat({ label, value, current, previous, days, lead }) {
  const known = previous !== undefined && previous !== null && current !== undefined && current !== null;
  const tiny = known && (previous === 0 || current / previous > 20);
  const d = known && !tiny ? change(current, previous) : null;
  return (
    <div className={`card stat ${lead ? "lead" : ""}`}>
      <span className="label">{label}</span>
      <span className="value">{value}</span>
      <span className="delta">
        {tiny ? (
          `${num(previous)} in the previous ${days} days`
        ) : d === null ? (
          " "
        ) : (
          <>
            <span className={d >= 0 ? "positive" : "negative"}>
              {d >= 0 ? "+" : ""}
              {d.toFixed(1)}%
            </span>{" "}
            vs previous {days} days
          </>
        )}
      </span>
    </div>
  );
}

export function Avatar({ src, name, size = "" }) {
  const [broken, setBroken] = useState(false);
  if (src && !broken) {
    return <img className={`avatar ${size}`} src={src} alt="" onError={() => setBroken(true)} referrerPolicy="no-referrer" />;
  }
  return (
    <span className={`avatar ${size}`} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

export function Thumb({ src, lg }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) return <span className={`thumb ${lg ? "lg" : ""}`} aria-hidden="true" />;
  return (
    <img
      className={`thumb ${lg ? "lg" : ""}`}
      src={src}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
    />
  );
}

export function Spinner({ size = 16 }) {
  return <LoaderCircle size={size} strokeWidth={1.5} className="spin" aria-label="Loading" />;
}

export function ErrorNotice({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="notice error" role="alert">
      <CircleAlert {...ICON} />
      <div style={{ flex: 1 }}>
        <b>Something went wrong</b>
        <div>{error.message}</div>
      </div>
      {onRetry && (
        <button className="btn sm" onClick={onRetry}>
          <RefreshCw size={14} strokeWidth={1.5} /> Retry
        </button>
      )}
    </div>
  );
}

export function Empty({ title, children, actions }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {actions && <div className="actions">{actions}</div>}
    </div>
  );
}

export function Skeleton({ h = 16, w = "100%", style }) {
  return <div className="skeleton" style={{ height: h, width: w, ...style }} />;
}

export function Drawer({ title, onClose, children, actions }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <>
      <div className="overlay" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label={typeof title === "string" ? title : undefined}>
        <div className="drawer-head">
          <h2>{title}</h2>
          <div style={{ display: "flex", gap: 8 }}>
            {actions}
            <button className="btn ghost icon" onClick={onClose} aria-label="Close">
              <X {...ICON} />
            </button>
          </div>
        </div>
        <div className="drawer-body">{children}</div>
      </aside>
    </>
  );
}

export function Confirm({ title, body, confirmLabel = "Confirm", danger, busy, onConfirm, onCancel }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);
  return (
    <>
      <div className="overlay" onClick={onCancel} />
      <div className="dialog" role="alertdialog" aria-label={title}>
        <h2>{title}</h2>
        {body && <p>{body}</p>}
        <div className="actions">
          <button className="btn ghost" onClick={onCancel}>
            Cancel
          </button>
          <button className={`btn ${danger ? "danger" : "primary"}`} onClick={onConfirm} disabled={busy}>
            {busy && <Spinner size={14} />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </>
  );
}

// Holds a pending confirmation: const [ask, dialog] = useConfirm(); ask({...}).then(ok => ...)
export function useConfirm() {
  const [state, setState] = useState(null);
  const ask = (opts) =>
    new Promise((resolve) => {
      setState({ ...opts, resolve });
    });
  const dialog = state ? (
    <Confirm
      {...state}
      onConfirm={() => {
        state.resolve(true);
        setState(null);
      }}
      onCancel={() => {
        state.resolve(false);
        setState(null);
      }}
    />
  ) : null;
  return [ask, dialog];
}
